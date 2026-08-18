# Little Bitty 现场销售台

双击 `启动销售台.command` 即可打开。也可以在终端运行：

```bash
/Users/leevengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

浏览器打开 `http://localhost:3000`。同一 Wi-Fi 下的手机打开电脑局域网地址（例如 `http://192.168.1.10:3000`）即可实时同步。数据保存在自动生成的 `data.json` 中。

云端部署时可设置 `DATA_DIR=/data`，并把持久化磁盘挂载到 `/data`，确保重新部署后销售记录不会丢失。
