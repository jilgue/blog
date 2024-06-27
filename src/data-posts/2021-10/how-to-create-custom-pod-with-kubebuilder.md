---
title: How to create custom pod with Kubebuilder
date: '2021-10-13'
description: In this post we’ll implement a simple Kubernetes controller using the kubebuilder.
tags: kubernetes, kubebuilder, kubernetesoperator
---

# How to create custom pod with Kubebuilder

In this post we’ll implement a simple Kubernetes controller using the [kubebuilder](https://github.com/kubernetes-sigs/kubebuilder).

![](./kubebuilder.webp)

Kubebuilder has a [book](https://book.kubebuilder.io/) but I think that it is too complex for beginning users. I’m going to try to do it easier. We’ll implement a simple operator which manage a pod.

## Install Kubebuilder

Kubebuilder doesn’t support Go 1.17, so we need to install Go 1.16. I decided to use [goenv](https://github.com/syndbg/goenv) to manager Go versions.

-   Remove previous Go version
-   Install goenv: [https://github.com/syndbg/goenv/blob/master/INSTALL.md](https://github.com/syndbg/goenv/blob/master/INSTALL.md)
-   Install Go 1.16:

```
$ goenv install 1.16.8
```

-   Use this version:

```
$ goenv global 1.16.8
```

-   Install Kubebuilder:

```
$ curl -L -o ~/.local/bin/kubebuilder https://go.kubebuilder.io/dl/latest/$(go env GOOS)/$(go env GOARCH)
$ chmod a+x ~/.local/bin/kubebuilder
```

## Initialize a project and create new API

We have to follow three steps to create a new white project with one custom resource.

```
$ mkdir medium-kubebuilder-pod
$ cd !$
$ git init
$ go mod init simplepod
$ kubebuilder init --domain callepuzzle.com
$ git add .
$ git commit -m "init"
$ kubebuilder create api --group medium --version v1alpha1 --kind SimplePod
$ git add .
$ git commit -m "create api"
```

Great, we have all the necessary scaffolding for our project.

If we now run _make install_, kubebuilder should generate the base CRDs under _config/crd/bases_ and a few other files for us. Running _make run_ should now allow us to launch the operator locally.

```
$ make install
/home/cesar/projects/k8s-operator/medium-kubebuilder-pod/bin/controller-gen "crd:trivialVersions=true,preserveUnknownFields=false" rbac:roleName=manager-role webhook paths="./..." output:crd:artifacts:config=config/crd/bases
go: creating new go.mod: module tmp
Downloading sigs.k8s.io/kustomize/kustomize/v3@v3.8.7
go get: added sigs.k8s.io/kustomize/kustomize/v3 v3.8.7
/home/cesar/projects/k8s-operator/medium-kubebuilder-pod/bin/kustomize build config/crd | kubectl apply -f -
customresourcedefinition.apiextensions.k8s.io/simplepods.medium.callepuzzle.com created$ kubectl get customresourcedefinitions.apiextensions.k8s.io simplepods.medium.callepuzzle.com 
NAME                                CREATED AT
simplepods.medium.callepuzzle.com   2021-10-13T15:47:52Z$ kubectl apply -f config/samples/medium_v1alpha1_simplepod.yaml$ kubectl get simplepods.medium.callepuzzle.com 
NAME               AGE
simplepod-sample   9s
```

Ok, we can create “simplepod” resources but it doesn’t do anything, doesn’t have any logic.

## Make our custom resource

In api/v1alpha1/simplepod\_types.go is defined struct of our resource.

```
$ git diff api/v1alpha1/simplepod_types.go config/samples/medium_v1alpha1_simplepod.yaml
diff --git a/api/v1alpha1/simplepod_types.go b/api/v1alpha1/simplepod_types.go
index f5f3fde..e4f0630 100644
--- a/api/v1alpha1/simplepod_types.go
+++ b/api/v1alpha1/simplepod_types.go
@@ -29,7 +29,7 @@ type SimplePodSpec struct {
        // Important: Run "make" to regenerate code after modifying this file
 
        // Foo is an example field of SimplePod. Edit simplepod_types.go to remove/update
-       Foo string `json:"foo,omitempty"`
+       Command string `json:"command,omitempty"`
 }
 
 // SimplePodStatus defines the observed state of SimplePod
diff --git a/config/samples/medium_v1alpha1_simplepod.yaml b/config/samples/medium_v1alpha1_simplepod.yaml
index 671c617..dd8cda0 100644
--- a/config/samples/medium_v1alpha1_simplepod.yaml
+++ b/config/samples/medium_v1alpha1_simplepod.yaml
@@ -4,4 +4,4 @@ metadata:
   name: simplepod-sample
 spec:
   # Add fields here
-  foo: bar
+  command: ls
```

Every time we change the struct of our resource we have to run _make install_ to regenerate the manifests.

Now, we implement the logic of our operator. Create a pod object and execute the command given by simplepod object.

```
$ git diff controllers/simplepod_controller.go
diff --git a/controllers/simplepod_controller.go b/controllers/simplepod_controller.go
index 2f13668..89b63d0 100644
--- a/controllers/simplepod_controller.go
+++ b/controllers/simplepod_controller.go
@@ -18,7 +18,10 @@ package controllers
 
 import (
        "context"
+       "strings"
 
+       corev1 "k8s.io/api/core/v1"
+       metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
        "k8s.io/apimachinery/pkg/runtime"
        ctrl "sigs.k8s.io/controller-runtime"
        "sigs.k8s.io/controller-runtime/pkg/client"
@@ -36,6 +39,7 @@ type SimplePodReconciler struct {
 //+kubebuilder:rbac:groups=medium.callepuzzle.com,resources=simplepods,verbs=get;list;watch;create;update;patch;delete
 //+kubebuilder:rbac:groups=medium.callepuzzle.com,resources=simplepods/status,verbs=get;update;patch
 //+kubebuilder:rbac:groups=medium.callepuzzle.com,resources=simplepods/finalizers,verbs=update
+//+kubebuilder:rbac:groups=core,resources=pods,verbs=get;list;watch;create;update;patch;delete
 
 // Reconcile is part of the main kubernetes reconciliation loop which aims to
 // move the current state of the cluster closer to the desired state.
@@ -47,16 +51,62 @@ type SimplePodReconciler struct {
 // For more details, check Reconcile and its Result here:
 // - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.8.3/pkg/reconcile
 func (r *SimplePodReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
-       _ = log.FromContext(ctx)
+       log := log.FromContext(ctx)
 
-       // your logic here
+       var instance mediumv1alpha1.SimplePod
+       errGet := r.Get(ctx, req.NamespacedName, &instance)
+       if errGet != nil {
+               log.Error(errGet, "Error getting instance")
+               return ctrl.Result{}, client.IgnoreNotFound(errGet)
+       }
+
+       pod := NewPod(&instance)
+
+       _, errCreate := ctrl.CreateOrUpdate(ctx, r.Client, pod, func() error {
+               return ctrl.SetControllerReference(&instance, pod, r.Scheme)
+       })
+
+       if errCreate != nil {
+               log.Error(errCreate, "Error creating pod")
+               return ctrl.Result{}, nil
+       }
+
+       err := r.Status().Update(context.TODO(), &instance)
+       if err != nil {
+               return ctrl.Result{}, err
+       }
 
        return ctrl.Result{}, nil
 }
 
+func NewPod(pod *mediumv1alpha1.SimplePod) *corev1.Pod {
+       labels := map[string]string{
+               "app": pod.Name,
+       }
+
+       return &corev1.Pod{
+               ObjectMeta: metav1.ObjectMeta{
+                       Name:      pod.Name,
+                       Namespace: pod.Namespace,
+                       Labels:    labels,
+               },
+               Spec: corev1.PodSpec{
+                       Containers: []corev1.Container{
+                               {
+                                       Name:    "busybox",
+                                       Image:   "busybox",
+                                       Command: strings.Split(pod.Spec.Command, " "),
+                               },
+                       },
+                       RestartPolicy: corev1.RestartPolicyOnFailure,
+               },
+       }
+}
+
 // SetupWithManager sets up the controller with the Manager.
 func (r *SimplePodReconciler) SetupWithManager(mgr ctrl.Manager) error {
        return ctrl.NewControllerManagedBy(mgr).
                For(&mediumv1alpha1.SimplePod{}).
+               Owns(&corev1.Pod{}).
                Complete(r)
 }
```

Then, install our changes and run the operator:

```
$ go get k8s.io/api/core/v1@v0.20.2
$ make install
$ kubectl delete -f config/samples/medium_v1alpha1_simplepod.yaml
$ kubectl apply -f config/samples/medium_v1alpha1_simplepod.yaml
$ make run
(in another terminal)
$ kubectl get pod
NAME               READY   STATUS      RESTARTS   AGE
simplepod-sample   0/1     Completed   0          3s
$ kubectl logs simplepod-sample 
bin
dev
etc
home
proc
root
sys
tmp
usr
var
```

Entire final code: [https://github.com/jilgue/medium-kubebuilder-pod](https://github.com/jilgue/medium-kubebuilder-pod)