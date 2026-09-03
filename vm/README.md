# 君科门诊管理系统 Demo 环境

在 Linux Cloud Agent 环境中通过 QEMU/KVM 运行 Windows Server 2022 虚拟机，并自动安装 SQL Server Express 与君科门诊管理系统。

## 架构

```
浏览器 (noVNC) --> websockify:6080 --> QEMU VNC:5901 --> Windows Server VM
                                                      --> SQL Server Express
                                                      --> 君科门诊管理系统 (桌面客户端)
```

## 快速启动

```bash
# 1. 等待 ISO 下载完成
ls -lh /workspace/vm/iso/

# 2. 启动虚拟机
/workspace/vm/scripts/start-vm.sh

# 3. 启动 noVNC 远程桌面
/workspace/vm/scripts/start-novnc.sh

# 4. 访问远程桌面
# 浏览器打开: http://<your-host>:6080/vnc.html
```

## 默认凭据

| 项目 | 值 |
|------|-----|
| Windows 管理员 | `Administrator` |
| 密码 | `QWErty123!` |
| SQL Server 实例 | `localhost\SQLEXPRESS` |
| VNC 端口 | `5901` |
| noVNC 端口 | `6080` |

## 注意事项

- **君科门诊管理系统** 是 Windows 桌面客户端，不是 Web Dashboard。通过 noVNC 远程桌面查看和操作。
- 软件依赖 **Microsoft SQL Server**（已自动安装 Express 版）。
- Windows Server 评估版有效期 180 天。
- 首次安装 Windows + SQL Server + 门诊软件约需 30-60 分钟。

## 文件结构

```
vm/
├── iso/                    # Windows Server ISO, virtio-win ISO
├── disks/windows.qcow2     # 虚拟机磁盘 (80GB)
├── scripts/
│   ├── autounattend.xml    # Windows 无人值守安装配置
│   ├── post-install.ps1    # 自动安装 SQL Server + 门诊软件
│   ├── start-vm.sh         # 启动 QEMU 虚拟机
│   └── start-novnc.sh      # 启动 noVNC Web 远程桌面
└── config/                 # 运行时日志和 PID 文件
```
