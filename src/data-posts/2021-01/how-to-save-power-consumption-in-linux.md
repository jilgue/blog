---
title: How to save power consumption in Linux
date: '2021-01-19'
description: How to save battery power in Linux using Powertop and acpid
tags: linux, powertop, battery
---

# How to save power consumption in Linux

![](./how-to-save-power-consumption-in-linux.webp)

[Powertop](https://wiki.archlinux.org/index.php/Powertop) is a great tool to save battery power and with the help of another tool, [acpid](https://wiki.archlinux.org/index.php/Acpid), to observe the acpi event and configure it automatically.

Acpid comes with predefined actions for triggered events. By default, these actions are defined in /etc/acpi/handler.sh

The action “ac\_adapter” has a default option

```
*)
                logger "ACPI action undefined: $2"
```

So, whether or not you are plugged in the ac, you can see the log with:

```
journalctl -f

ene 12 20:54:49 msi root[3888]: ACPI action undefined: ACPI0003:00
```

In this case you must to change the `/etc/acpi/handler.sh` with:

```
ac_adapter)
        case "$2" in
            ACPI0003:00)
```

Saving the changes and unplug the ac, the following appears in the log:

```
ene 12 21:00:31 msi root[6101]: AC unpluged
```

The change works. Now you can add the powertop commands. This is my `handler.sh`:

```
ac_adapter)
        case "$2" in
            ACPI0003:00)
                case "$4" in
                    00000000)
                        powertop --auto-tune
                        echo 'on' > '/sys/bus/usb/devices/3-2/power/control' # USB USB Receiver [Logitech]
                        echo 'enabled' > '/sys/class/net/wlo1/device/power/wakeup'
                        echo 'enabled' > '/sys/bus/usb/devices/usb1/power/wakeup'
                        echo 'enabled' > '/sys/bus/usb/devices/usb2/power/wakeup'
                        echo 'enabled' > '/sys/bus/usb/devices/usb3/power/wakeup'
                        echo 'enabled' > '/sys/bus/usb/devices/usb4/power/wakeup'
                        echo 'enabled' > '/sys/bus/usb/devices/3-2/power/wakeup'
                        echo 'enabled' > '/sys/bus/usb/devices/3-5/power/wakeup'
                        echo 'enabled' > '/sys/bus/usb/devices/3-10/power/wakeup'
                        logger 'AC unpluged'
                        ;;
                    00000001)
                        echo 'disabled' > '/sys/class/net/wlo1/device/power/wakeup'
                        echo 'disabled' > '/sys/bus/usb/devices/usb1/power/wakeup'
                        echo 'disabled' > '/sys/bus/usb/devices/usb2/power/wakeup'
                        echo 'disabled' > '/sys/bus/usb/devices/usb3/power/wakeup'
                        echo 'disabled' > '/sys/bus/usb/devices/usb4/power/wakeup'
                        echo 'disabled' > '/sys/bus/usb/devices/3-2/power/wakeup'
                        echo 'disabled' > '/sys/bus/usb/devices/3-5/power/wakeup'
                        echo 'disabled' > '/sys/bus/usb/devices/3-10/power/wakeup'
                        logger 'AC pluged'
                        ;;
```

Remember, this doesn’t work if you start the laptop without an ac. How do you solve it?  
Inspired by the following [post](https://bbs.archlinux.org/viewtopic.php?id=139980) I created a new systemd unit:

```
/usr/lib/systemd/system/acpid-boot.service

[Unit]
Description=ACPI boot handle
Documentation=man:acpid(8)

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/acpi-boot-handle.sh

[Install]
WantedBy=multi-user.target
```

And the script `/usr/local/sbin/acpi-boot-handle.sh` contains:

```
#!/usr/bin/env bash
set -euo pipefail

if [[ $(acpi -a | grep on) ]]
then
        onBit=1
else
        onBit=0
fi
/etc/acpi/handler.sh ac_adapter ACPI0003:00 foo 0000000$onBit
```

In this way you simulate the acpi action when the laptop starts.

In my case a MSI Modern 14 the battery has 3 hours more when all of the powertop options are enabled.