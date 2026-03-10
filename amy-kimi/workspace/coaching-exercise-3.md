# 练习3：Tool Diagnostic — xhs-browse.mjs

## 诊断步骤

### 1. 实际运行工具
```
$ node agents/amy-kimi/tools/xhs-browse.mjs feed
```

### 2. 精确错误信息
```json
{"status":"error","error":"connect ECONNREFUSED 127.0.0.1:9222"}
```
退出码：1

### 3. 根因分析

工具通过 Chrome DevTools Protocol (CDP) 连接 `localhost:9222` 来控制浏览器。

**Chrome 进程状态：** Chrome 正在运行（PID 15），版本 145.0.7632.159，运行在 DISPLAY=:99 上。

**Chrome 启动参数（从 `/proc/15/cmdline` 提取）：**
```
/opt/google/chrome/chrome
--no-sandbox
--disable-gpu
--no-first-run
--disable-dev-shm-usage
--start-maximized
--user-data-dir=/tmp/chrome-profile
```

**问题：Chrome 缺少 `--remote-debugging-port=9222` 启动参数。** 

没有这个参数，Chrome 不会暴露 CDP WebSocket 接口，工具无法通过 HTTP 连接到 `127.0.0.1:9222` 进行任何操作。

### 4. 恢复所需条件

要使工具可用，需要：

1. **重启 Chrome 并添加调试端口参数：**
   ```bash
   /opt/google/chrome/chrome \
     --no-sandbox --disable-gpu --no-first-run \
     --disable-dev-shm-usage --start-maximized \
     --user-data-dir=/tmp/chrome-profile \
     --remote-debugging-port=9222
   ```

2. **确认 CDP 端口可访问：**
   ```bash
   curl http://localhost:9222/json/version
   ```
   应返回 Chrome 版本信息的 JSON。

3. **确保小红书页面已加载且未触发 CAPTCHA：**
   工具设计为连接已存在的 XHS 标签页（参考工具源码中 `getXHSTab()` 函数），需要浏览器已导航到 xiaohongshu.com。

### 5. 注意事项

- 这是一个**环境配置问题**，不是工具代码缺陷
- 工具文件本身存在且可执行（`-rwxr-xr-x`，12316 字节）
- Chrome 可能是由其他进程（如 Amy 的主工具链）启动的，当时可能包含了调试端口参数但后来被重启时遗漏
- 我没有尝试自行重启 Chrome，因为这可能干扰其他正在使用浏览器的 Agent
