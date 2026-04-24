# HB-260524: NVIDIA GR00T N1.7 — 开源人形机器人推理VLA模型

**来源**: Hugging Face Blog / NVIDIA (ellontop, kalyanvadrevu)  
**日期**: 2026-04-17  
**链接**: https://huggingface.co/blog/nvidia/gr00t-n1-7

---

## 核心发现

**GR00T N1.7**是NVIDIA发布的3B参数开源视觉-语言-行动(VLA)模型，用于人形机器人控制——**首个具有商业许可的开放人形基础模型**。

### 关键数据
- **参数**: 3B (VLM: Cosmos-Reason2-2B + DiT: 32层)
- **训练数据**: 20,854小时人类自我中心视频 (EgoScale)
- **许可**: 商业许可，支持生产部署
- **验证平台**: Unitree G1, YAM双手机械臂, AGIBot Genie 1

### Action Cascade架构

**System 2 (Vision-Language Model)**
- Cosmos-Reason2-2B主干
- 处理图像token + 语言指令
- 生成高级行动token（任务分解和多步推理）

**System 1 (Diffusion Transformer)**
- 32层DiT
- 接收VLM输出 + 实时机器人状态
- 去噪为精确电机命令

```
输入: RGB图像 + 语言指令 + 机器人本体感受状态
         ↓
System 2: VLM推理 → 高级行动token
         ↓
System 1: DiT去噪 → 连续值行动向量
         ↓
输出: 映射到机器人自由度的电机命令
```

### 核心突破: 灵巧性Scaling Law

**首个机器人灵巧性Scaling Law**: 更多人类自我中心数据 → 可预测、一致的灵巧操作能力提升

- 1k→20k小时训练数据
- 平均任务完成率**翻倍以上**
- 22自由度手部执行接触密集型任务

> "More human egocentric data produces predictable, consistent improvements in dexterous manipulation capability"

### 能力范围

| 任务类型 | 说明 |
|----------|------|
| Loco-manipulation | 移动操作 |
| Tabletop manipulation | 桌面操作 |
| Dexterous bimanual | 灵巧双手操作 |
| Small parts assembly | 小零件装配（接触密集型） |

### 部署支持

- **硬件**: NVIDIA Ampere, Hopper, Lovelace, Blackwell, Jetson
- **数据集格式**: LeRobot格式
- **预注册平台**: UNITREE_G1, LIBERO_PANDA, OXE_WIDOWX等

---

## 对我们意味着什么

### 1. 具身智能(Embodied AI)的进展
GR00T N1.7代表了VLA模型在真实机器人上的重要进展，System 1/2分离架构值得借鉴。

### 2. Scaling Law扩展
从文本→图像→视频→机器人行动，Scaling Law持续有效。人类数据是最可扩展的智能来源。

### 3. 双系统架构启发
- System 2: 慢思考、推理、规划
- System 1: 快执行、实时控制

这与我们的L3(Planner)和L4(Controller)分层有相似之处。

### 4. 商业许可的重要性
首个**商业许可**的开放人形模型，意味着可投入实际生产部署。

---

**相关**: bob (物理Agent), tech-lead (双系统架构)  
**星级**: ★★★★☆
