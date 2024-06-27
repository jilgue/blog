---
title: Como ejecutar varios tests en Terratest
date: '2020-08-13'
description: Como ejecutar varios tests en Terratest
tags: terratest, golang, testing
---

# Como ejecutar varios tests en Terratest

![](./como-ejecutar-varios-tests-en-terratest.webp)

Terratest es un framework para ejecutar test en Terraform. En este caso yo tenía un módulo muy sencillo que compone un nombre y quería probar que todas las posibles entradas funcionasen.

A la hora de ejecutar varios tests en Terratest, lo primero que se me vino a la cabeza fue crear varias funciones con cada caso que quería probar:

```go
package test

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

func TestTerraformComplete(t *testing.T) {
	t.Parallel()

	terraformOptions := &terraform.Options{
		TerraformDir: "../",

		Vars: map[string]interface{}{
			"type": "avs",
			"company": "hb01",
			"environment": "hub01",
			"project": "shs01",
			"location": "weu",
			"function": "dns",
			"num": "01",
		},
	}

	terraform.InitAndApply(t, terraformOptions)

	name := terraform.Output(t, terraformOptions, "name")
	assert.Equal(t, name, "avs-hb01-hub01-shs01-weu-dns-01")
}

func TestTerraformNoFunction(t *testing.T) {
	t.Parallel()

	terraformOptions := &terraform.Options{
		TerraformDir: "../",

		Vars: map[string]interface{}{
			"type": "avs",
			"company": "hb01",
			"environment": "hub01",
			"project": "shs01",
			"location": "weu",
			"num": "01",
		},
	}

	terraform.InitAndApply(t, terraformOptions)

	name := terraform.Output(t, terraformOptions, "name")
	assert.Equal(t, name, "avs-hb01-hub01-shs01-weu-01")
}
```

Con la sorpresa de que apareció un mensaje de error como este:

```
TestTerraformNoFunction 2020-08-11T22:35:11+02:00 logger.go:66: avs-hb01-hub01-shs01-weu-dns-01
    terraform_azure_test.go:52: 
        	Error Trace:	terraform_azure_test.go:52
        	Error:      	Not equal: 
        	            	expected: "avs-hb01-hub01-shs01-weu-dns-01"
        	            	actual  : "avs-hb01-hub01-shs01-weu-01"
        	            	
        	            	Diff:
        	            	--- Expected
        	            	+++ Actual
        	            	@@ -1 +1 @@
        	            	-avs-hb01-hub01-shs01-weu-dns-01
        	            	+avs-hb01-hub01-shs01-weu-01
        	Test:       	TestTerraformNoFunction
--- FAIL: TestTerraformNoFunction (4.74s)
TestTerraformComplete 2020-08-11T22:35:11+02:00 logger.go:66: avs-hb01-hub01-shs01-weu-dns-01
--- PASS: TestTerraformComplete (4.77s)
FAIL
exit status 1
FAIL	test	4.780s
```

Después de revisarlo no veía error en el código, pero parecía que estuviese mezclando las variables de las dos funciones.

¿Cuál era el problema? Pues resultó ser el `t.Parallel()`. Yo sé de Golang lo justo para pasar el día pero tiene toda la pinta de que el ejecutar cada paso en paralelo Terraform se vuelve un poco loco.

Solución:

-   Quitar la ejecución en paralelo

```go
package test

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

func TestTerraformComplete(t *testing.T) {

	terraformOptions := &terraform.Options{
		TerraformDir: "../",

		Vars: map[string]interface{}{
			"type": "avs",
			"company": "hb01",
			"environment": "hub01",
			"project": "shs01",
			"location": "weu",
			"function": "dns",
			"num": "01",
		},
	}

	terraform.InitAndApply(t, terraformOptions)

	name := terraform.Output(t, terraformOptions, "name")
	assert.Equal(t, name, "avs-hb01-hub01-shs01-weu-dns-01")
}

func TestTerraformNoFunction(t *testing.T) {

	terraformOptions := &terraform.Options{
		TerraformDir: "../",

		Vars: map[string]interface{}{
			"type": "avs",
			"company": "hb01",
			"environment": "hub01",
			"project": "shs01",
			"location": "weu",
			"num": "01",
		},
	}

	terraform.InitAndApply(t, terraformOptions)

	name := terraform.Output(t, terraformOptions, "name")
	assert.Equal(t, name, "avs-hb01-hub01-shs01-weu-01")
}
```

-   Ejecutar los tests desde una misma función

```go
package test

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

func TestTerraform(t *testing.T) {
	t.Parallel()

	Complete(t)
	NoFunction(t)
}

func Complete(t *testing.T) {

	terraformOptions := &terraform.Options{
		TerraformDir: "../",

		Vars: map[string]interface{}{
			"type": "avs",
			"company": "hb01",
			"environment": "hub01",
			"project": "shs01",
			"location": "weu",
			"function": "dns",
			"num": "01",
		},
	}

	terraform.InitAndApply(t, terraformOptions)

	name := terraform.Output(t, terraformOptions, "name")
	assert.Equal(t, name, "avs-hb01-hub01-shs01-weu-dns-01")
}

func NoFunction(t *testing.T) {

	terraformOptions := &terraform.Options{
		TerraformDir: "../",

		Vars: map[string]interface{}{
			"type": "avs",
			"company": "hb01",
			"environment": "hub01",
			"project": "shs01",
			"location": "weu",
			"num": "01",
		},
	}

	terraform.InitAndApply(t, terraformOptions)

	name := terraform.Output(t, terraformOptions, "name")
	assert.Equal(t, name, "avs-hb01-hub01-shs01-weu-01")
}
```

Espero que os sirva de ayuda :)