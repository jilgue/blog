---
title: Secrets in ArgoCD with Sops
date: '2022-09-07'
description: Secrets in ArgoCD with Sops and GCP KMS
---

[ArgoCD](https://argoproj.github.io/cd/) is a tool that implements the gitops philosophy for deploying applications on Kubernetes. It is a declarative, Git-based deployment system that uses a simple, human-readable manifest file to define the desired state of your application. In this article, we will explore how to use ArgoCD with [Sops](https://github.com/mozilla/sops) to manage secrets in a gitops workflow.

We are using [sops with GCP KMS](https://github.com/mozilla/sops#encrypting-using-gcp-kms), the first thing we need is a service account with the role `roles/cloudkms.cryptoKeyDecrypter` and create a secret on Kubernetes:

`kubectl create secret generic kms-sa --from-file sa.json`

The idea is to use Argo [Config Management Plugin](https://argo-cd.readthedocs.io/en/stable/user-guide/config-management-plugins/) to decrypt the secret and generate a plane yaml with all Kubernetes objects (deployment, services, ...) and use [Cumstom Tooling](https://argo-cd.readthedocs.io/en/stable/operator-manual/custom_tools/) to install Sops and other tools needed.

In the process we have encountered several problems, and one of them is that it is necessary to use yq to properly format the output yamls and avoid errors such like: `error converting YAML to JSON: yaml: line 4: did not find expected ',' or ']'.`

These are the values to install argo-cd by Helm. The configuration assumes that all secrets are in the `secrets.enc` file encoded with yaml.

```yaml
server:
  config:
    configManagementPlugins: |
      - name: sops
        init:
          command: ["/bin/sh", "-c"]
          args: ["if [ -f 'secrets.enc' ]; then echo '---' > secrets.yaml && sops -d --input-type yaml --output-type yaml secrets.enc >> secrets.yaml; fi"]
        generate:
          command: ["/bin/sh", "-c"]
          args: ["cat *.yaml | yq"]
repoServer:
  volumes:
    - name: custom-tools
      emptyDir: {}
    - name: kms-sa
      secret:
        secretName: kms-sa
        items:
          - key: sa.json
            path: sa.json
  volumeMounts:
    - mountPath: /usr/local/bin/sops
      name: custom-tools
      subPath: sops
    - mountPath: /usr/local/bin/jq
      name: custom-tools
      subPath: jq
    - mountPath: /usr/local/bin/yq
      name: custom-tools
      subPath: yq
    - mountPath: /etc/secrets/sa.json
      name: kms-sa
      subPath: sa.json
  env:
    - name: GOOGLE_APPLICATION_CREDENTIALS
      value: /etc/secrets/sa.json
  initContainers:
    - name: custom-tools
      image: alpine:3.8
      command: ['/bin/sh', '-c']
      args:
        - wget https://github.com/mozilla/sops/releases/download/v3.7.3/sops-v3.7.3.linux.amd64 -O /custom-tools/sops;
          chmod a+x /custom-tools/sops;
          wget https://github.com/stedolan/jq/releases/download/jq-1.6/jq-linux64 -O /custom-tools/jq;
          chmod a+x /custom-tools/jq;
          wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /custom-tools/yq;
          chmod +x /custom-tools/yq;
      volumeMounts:
        - mountPath: /custom-tools
          name: custom-tools
```

`helm upgrade sops argo/argo-cd --values values-sops.yaml`

And an application example to try it.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: secrets
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Callepuzzle/manifests
    targetRevision: main
    path: poc-argocd
    plugin:
      name: sops
  destination:
    name: ''
    namespace: ''
    server: 'https://kubernetes.default.svc'
```
