---
title: How to create custom pod with Kubebuilder
date: '2021-10-13'
description: In this post we’ll implement a simple Kubernetes controller using the kubebuilder.
---

# How to create custom pod with Kubebuilder

In this post we’ll implement a simple Kubernetes controller using the [kubebuilder](https://github.com/kubernetes-sigs/kubebuilder).

![](https://miro.medium.com/v2/resize:fit:1400/0*B18gKPgPP_UOoi4V)

Kubebuilder has a [book](https://book.kubebuilder.io/) but I think that it is too complex for beginning users. I’m going to try to do it easier. We’ll implement a simple operator which manage a pod.

## Install Kubebuilder

Kubebuilder doesn’t support Go 1.17, so we need to install Go 1.16. I decided to use [goenv](https://github.com/syndbg/goenv) to manager Go versions.

-   Remove previous Go version
-   Install goenv: [https://github.com/syndbg/goenv/blob/master/INSTALL.md](https://github.com/syndbg/goenv/blob/master/INSTALL.md)
-   Install Go 1.16:

```
<span id="3cdd" data-selectable-paragraph="">$ goenv install 1.16.8</span>
```

-   Use this version:

```
<span id="2f64" data-selectable-paragraph="">$ goenv global 1.16.8</span>
```

-   Install Kubebuilder:

```
<span id="3d4a" data-selectable-paragraph="">$ curl -L -o ~/.local/bin/kubebuilder <a href="https://go.kubebuilder.io/dl/latest/$(go" rel="noopener ugc nofollow" target="_blank">https://go.kubebuilder.io/dl/latest/$(go</a> env GOOS)/$(go env GOARCH)<br>$ chmod a+x ~/.local/bin/kubebuilder</span>
```

## Initialize a project and create new API

We have to follow three steps to create a new white project with one custom resource.

```
<span id="6d20" data-selectable-paragraph="">$ mkdir medium-kubebuilder-pod<br>$ cd !$<br>$ git init<br>$ go mod init simplepod<br>$ kubebuilder init --domain callepuzzle.com<br>$ git add .<br>$ git commit -m "init"<br>$ kubebuilder create api --group medium --version v1alpha1 --kind SimplePod<br>$ git add .<br>$ git commit -m "create api"</span>
```

Great, we have all the necessary scaffolding for our project.

If we now run _make install_, kubebuilder should generate the base CRDs under _config/crd/bases_ and a few other files for us. Running _make run_ should now allow us to launch the operator locally.

```
<span id="96f0" data-selectable-paragraph="">$ make install<br>/home/cesar/projects/k8s-operator/medium-kubebuilder-pod/bin/controller-gen "crd:trivialVersions=true,preserveUnknownFields=false" rbac:roleName=manager-role webhook paths="./..." output:crd:artifacts:config=config/crd/bases<br>go: creating new go.mod: module tmp<br>Downloading sigs.k8s.io/kustomize/kustomize/v3@v3.8.7<br>go get: added sigs.k8s.io/kustomize/kustomize/v3 v3.8.7<br>/home/cesar/projects/k8s-operator/medium-kubebuilder-pod/bin/kustomize build config/crd | kubectl apply -f -<br>customresourcedefinition.apiextensions.k8s.io/simplepods.medium.callepuzzle.com created</span><span id="d917" data-selectable-paragraph="">$ kubectl get customresourcedefinitions.apiextensions.k8s.io simplepods.medium.callepuzzle.com <br>NAME                                CREATED AT<br>simplepods.medium.callepuzzle.com   2021-10-13T15:47:52Z</span><span id="bdc5" data-selectable-paragraph="">$ kubectl apply -f config/samples/medium_v1alpha1_simplepod.yaml</span><span id="3171" data-selectable-paragraph="">$ kubectl get simplepods.medium.callepuzzle.com <br>NAME               AGE<br>simplepod-sample   9s</span>
```

Ok, we can create “simplepod” resources but it doesn’t do anything, doesn’t have any logic.

## Make our custom resource

In api/v1alpha1/simplepod\_types.go is defined struct of our resource.

```
<span id="923d" data-selectable-paragraph="">$ git diff api/v1alpha1/simplepod_types.go config/samples/medium_v1alpha1_simplepod.yaml<br>diff --git a/api/v1alpha1/simplepod_types.go b/api/v1alpha1/simplepod_types.go<br>index f5f3fde..e4f0630 100644<br>--- a/api/v1alpha1/simplepod_types.go<br>+++ b/api/v1alpha1/simplepod_types.go<br>@@ -29,7 +29,7 @@ type SimplePodSpec struct {<br>        // Important: Run "make" to regenerate code after modifying this file<br> <br>        // Foo is an example field of SimplePod. Edit simplepod_types.go to remove/update<br>-       Foo string `json:"foo,omitempty"`<br>+       Command string `json:"command,omitempty"`<br> }<br> <br> // SimplePodStatus defines the observed state of SimplePod<br>diff --git a/config/samples/medium_v1alpha1_simplepod.yaml b/config/samples/medium_v1alpha1_simplepod.yaml<br>index 671c617..dd8cda0 100644<br>--- a/config/samples/medium_v1alpha1_simplepod.yaml<br>+++ b/config/samples/medium_v1alpha1_simplepod.yaml<br>@@ -4,4 +4,4 @@ metadata:<br>   name: simplepod-sample<br> spec:<br>   # Add fields here<br>-  foo: bar<br>+  command: ls</span>
```

Every time we change the struct of our resource we have to run _make install_ to regenerate the manifests.

Now, we implement the logic of our operator. Create a pod object and execute the command given by simplepod object.

```
<span id="256d" data-selectable-paragraph="">$ git diff controllers/simplepod_controller.go<br>diff --git a/controllers/simplepod_controller.go b/controllers/simplepod_controller.go<br>index 2f13668..89b63d0 100644<br>--- a/controllers/simplepod_controller.go<br>+++ b/controllers/simplepod_controller.go<br>@@ -18,7 +18,10 @@ package controllers<br> <br> import (<br>        "context"<br>+       "strings"<br> <br>+       corev1 "k8s.io/api/core/v1"<br>+       metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"<br>        "k8s.io/apimachinery/pkg/runtime"<br>        ctrl "sigs.k8s.io/controller-runtime"<br>        "sigs.k8s.io/controller-runtime/pkg/client"<br>@@ -36,6 +39,7 @@ type SimplePodReconciler struct {<br> //+kubebuilder:rbac:groups=medium.callepuzzle.com,resources=simplepods,verbs=get;list;watch;create;update;patch;delete<br> //+kubebuilder:rbac:groups=medium.callepuzzle.com,resources=simplepods/status,verbs=get;update;patch<br> //+kubebuilder:rbac:groups=medium.callepuzzle.com,resources=simplepods/finalizers,verbs=update<br>+//+kubebuilder:rbac:groups=core,resources=pods,verbs=get;list;watch;create;update;patch;delete<br> <br> // Reconcile is part of the main kubernetes reconciliation loop which aims to<br> // move the current state of the cluster closer to the desired state.<br>@@ -47,16 +51,62 @@ type SimplePodReconciler struct {<br> // For more details, check Reconcile and its Result here:<br> // - <a href="https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.8.3/pkg/reconcile" rel="noopener ugc nofollow" target="_blank">https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.8.3/pkg/reconcile</a><br> func (r *SimplePodReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {<br>-       _ = log.FromContext(ctx)<br>+       log := log.FromContext(ctx)<br> <br>-       // your logic here<br>+       var instance mediumv1alpha1.SimplePod<br>+       errGet := r.Get(ctx, req.NamespacedName, &amp;instance)<br>+       if errGet != nil {<br>+               log.Error(errGet, "Error getting instance")<br>+               return ctrl.Result{}, client.IgnoreNotFound(errGet)<br>+       }<br>+<br>+       pod := NewPod(&amp;instance)<br>+<br>+       _, errCreate := ctrl.CreateOrUpdate(ctx, r.Client, pod, func() error {<br>+               return ctrl.SetControllerReference(&amp;instance, pod, r.Scheme)<br>+       })<br>+<br>+       if errCreate != nil {<br>+               log.Error(errCreate, "Error creating pod")<br>+               return ctrl.Result{}, nil<br>+       }<br>+<br>+       err := r.Status().Update(context.TODO(), &amp;instance)<br>+       if err != nil {<br>+               return ctrl.Result{}, err<br>+       }<br> <br>        return ctrl.Result{}, nil<br> }<br> <br>+func NewPod(pod *mediumv1alpha1.SimplePod) *corev1.Pod {<br>+       labels := map[string]string{<br>+               "app": pod.Name,<br>+       }<br>+<br>+       return &amp;corev1.Pod{<br>+               ObjectMeta: metav1.ObjectMeta{<br>+                       Name:      pod.Name,<br>+                       Namespace: pod.Namespace,<br>+                       Labels:    labels,<br>+               },<br>+               Spec: corev1.PodSpec{<br>+                       Containers: []corev1.Container{<br>+                               {<br>+                                       Name:    "busybox",<br>+                                       Image:   "busybox",<br>+                                       Command: strings.Split(pod.Spec.Command, " "),<br>+                               },<br>+                       },<br>+                       RestartPolicy: corev1.RestartPolicyOnFailure,<br>+               },<br>+       }<br>+}<br>+<br> // SetupWithManager sets up the controller with the Manager.<br> func (r *SimplePodReconciler) SetupWithManager(mgr ctrl.Manager) error {<br>        return ctrl.NewControllerManagedBy(mgr).<br>                For(&amp;mediumv1alpha1.SimplePod{}).<br>+               Owns(&amp;corev1.Pod{}).<br>                Complete(r)<br> }</span>
```

Then, install our changes and run the operator:

```
<span id="89fd" data-selectable-paragraph="">$ go get k8s.io/api/core/v1@v0.20.2<br>$ make install<br>$ kubectl delete -f config/samples/medium_v1alpha1_simplepod.yaml<br>$ kubectl apply -f config/samples/medium_v1alpha1_simplepod.yaml<br>$ make run<br>(in another terminal)<br>$ kubectl get pod<br>NAME               READY   STATUS      RESTARTS   AGE<br>simplepod-sample   0/1     Completed   0          3s<br>$ kubectl logs simplepod-sample <br>bin<br>dev<br>etc<br>home<br>proc<br>root<br>sys<br>tmp<br>usr<br>var</span>
```

Entire final code: [https://github.com/jilgue/medium-kubebuilder-pod](https://github.com/jilgue/medium-kubebuilder-pod)