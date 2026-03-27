# HB#1111: Spatial-TTT让AI脑海里建3D地图

**Source:** XHS @飞来那多  
**URL:** https://www.xiaohongshu.com/explore/69b5878d0000000021038854  
**Date:** 2026-03-14  
**Likes:** 10  
**L3 Flag:** #1111

---

## 核心内容

### 问题背景

传统Transformer处理长视频的"3D金鱼记忆"问题：
- 视频一长，显存呈**二次方爆炸** (OOM)
- 删减帧数 → 转身就忘刚才路过的沙发在哪

### 解决方案: Spatial-TTT

**机构:** 清华大学 × 腾讯混元  
**核心创新:**

#### 1. TTT (Test-Time Training) + Fast Weights

抛弃"死记硬背"所有画面的方法，装上 **"快权重"记忆体**：
- 边看边学，实时将3D空间坐标"压缩"进记忆体
- 局部梯度更新，真正的"过目不忘"

#### 2. 3D时空卷积

- 不再是2D截图，而是理解物体在时空中的连续运动
- 拥有物理直觉（柱子后面的皮卡丘还在那里）

### 实测数据

| 指标 | 表现 |
|------|------|
| 1024帧超长视频 | 其他模型OOM瘫痪，Spatial-TTT稳如老狗 |
| 显存增长 | **线性** (vs 传统二次方) |
| 参数规模 | 仅2B (20亿) |
| 空间问答榜单 | 硬刚甚至超越GPT-5和Gemini-3-Pro |

### 核心启示

> "与其给AI塞上万张显卡暴力处理长上下文，不如教AI像人类一样在线提取有用空间记忆"

---

## 对我们的意义

### 🔬 技术原理关联

**TTT (Test-Time Training)** 与我们的设计哲学：
- **类似点**: 运行时轻量适应，不修改基础权重
- **差异点**: Spatial-TTT用梯度更新，我们用Error Log经验积累
- **启示**: Fast Weights机制可借鉴到Skill动态组合

### 💡 架构设计启发

1. **记忆分层**: 快权重(Fast) + 慢权重(Slow) 双轨设计
2. **增量压缩**: 不是存储所有历史，而是提取结构化记忆
3. **线性扩展**: 追求O(n)而非O(n²)的上下文处理

### 📊 性能基准

- 2B参数 > GPT-5/Gemini-3-Pro 证明：**架构 > 规模**
- 与PonderLM-3 (HB#409) 类似：Token级自适应计算

---

## Metadata

- **Topics:** TTT, Test-Time Training, Embodied AI, 3D Vision, Tsinghua, Tencent Hunyuan
- **Paper Status:** 顶会级架构 (具体会议未标注)
- **Relevant to:** Scout (论文深度分析), tech-lead (记忆架构)
