---
title: Switchable graphics Nvidia / Intel in Linux
date: '2021-04-28'
description: How to enable and disable Nvidia in Linux
tags: linux, nvidia, intel
---

# Switchable graphics Nvidia / Intel in Linux

Many laptops have two graphics; Intel, which saves power, and Nvidia, which gives better performance.

![](./graphics-nvidia-intel.webp)

There are [several options](https://wiki.archlinux.org/index.php/NVIDIA_Optimus#Use_switchable_graphics) to use switchable graphics, PRIME, Bumblebee, nvidia-xrun…

None of these programs functions perfectly, there is always a problem. For example, Nvidia is still active in the background so there is not any power saving or Nvidia works but with any issue (games in Steam doesn’t work or not well)

At the end I choose to play any video game and then find a way to disable Nvidia when I want.

Following [Archlinux Nvidia guide](https://wiki.archlinux.org/index.php/NVIDIA#DRM_kernel_mode_setting), I created an Ansible playbook to enable and disable Nvidia

```yaml
---
- name: Nvidia DRM switch (disable)
  hosts: localhost
  become: yes
  tasks:

    - name: X11
      ansible.builtin.file:
        path: /etc/X11/xorg.conf.d/10-nvidia-drm-outputclass.conf
        state: absent

    - name: SDDM
      blockinfile:
        path: /usr/share/sddm/scripts/Xsetup
        insertafter: |
          #!/bin/sh
          # Xsetup - run as root before the login dialog appears
        block: ""

    - name: GRUB
      ansible.builtin.lineinfile:
        path: /etc/default/grub
        regexp: '^GRUB_CMDLINE_LINUX_DEFAULT='
        line: GRUB_CMDLINE_LINUX_DEFAULT="loglevel=3 quiet resume=/dev/mapper/Vol-swap"
      register: grub

    - name: Modules
      ansible.builtin.lineinfile:
        path: /etc/mkinitcpio.conf
        regexp: '^MODULES='
        line: MODULES=()
      register: modules

    - name: Backlist modules
      blockinfile:
        path: /etc/modprobe.d/blacklist.conf
        block: |
          blacklist nvidia
          blacklist nvidia_modeset
          blacklist nvidia_uvm
          blacklist nvidia_drm
    - name: Re-generate the grub.cfg
      ansible.builtin.command: grub-mkconfig -o /boot/grub/grub.cfg
      when: grub.changed

    - name: Re-generate image
      ansible.builtin.command: mkinitcpio -P
      when: modules.changed
```

```yaml
---
- name: Nvidia DRM switch (enable)
  hosts: localhost
  become: yes
  tasks:

    - name: X11
      ansible.builtin.copy:
        src: "{{ playbook_dir }}/10-nvidia-drm-outputclass.conf"
        dest: /etc/X11/xorg.conf.d/10-nvidia-drm-outputclass.conf
        owner: root
        group: root
        mode: '0644'

    - name: SDDM
      blockinfile:
        path: /usr/share/sddm/scripts/Xsetup
        insertafter: |
          #!/bin/sh
          # Xsetup - run as root before the login dialog appears
        block: |
          xrandr --setprovideroutputsource modesetting NVIDIA-0
          xrandr --auto
    - name: GRUB
      ansible.builtin.lineinfile:
        path: /etc/default/grub
        regexp: '^GRUB_CMDLINE_LINUX_DEFAULT='
        line: GRUB_CMDLINE_LINUX_DEFAULT="loglevel=3 quiet resume=/dev/mapper/Vol-swap nvidia-drm.modeset=1"
      register: grub

    - name: Modules
      ansible.builtin.lineinfile:
        path: /etc/mkinitcpio.conf
        regexp: '^MODULES='
        line: MODULES=(nvidia nvidia_modeset nvidia_uvm nvidia_drm)
      register: modules

    - name: Re-generate the grub.cfg
      ansible.builtin.command: grub-mkconfig -o /boot/grub/grub.cfg
      when: grub.changed

    - name: Re-generate image
      ansible.builtin.command: mkinitcpio -P
      when: modules.change
```

The changes require a reboot the laptop but since I don’t play every day this issue is acceptable for me.

There are two more commands to execute when you are using the battery:

```
# echo '\_SB.PCI0.PEG0.PEGP._OFF' > /proc/acpi/call
# rmmod nvidia
```

These commands increase three or four hour using the battery, I will research how to add them to my [/etc/acpi/handler.sh](https://dev.callepuzzle.com/how-to-save-power-consumption-in-linux-c78e56a912f8) script to run automatically.