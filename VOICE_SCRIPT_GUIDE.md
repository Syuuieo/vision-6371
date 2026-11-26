# 《风信 · Windpost》序章配音台词对照表（可直接批量导出替换 `public/voice/`）

> **当前语音开关位置**：[`src/components/PrologueExperience.tsx`](src/components/PrologueExperience.tsx) 顶部常量 `PROLOGUE_VOICE_AUTOPLAY`  
> 全量 **32 条序章剧情 + 14 条国内城市电台回响** 已通过阿里云百炼 Qwen-TTS（`qwen3-tts-flash`，音色：`Serena` 林微 / `Ethan` 陈舟 / `Kai` 旁白）合成并写入 `public/voice/`，`PROLOGUE_VOICE_AUTOPLAY` 已开启为 `true`。  
> **如需单独重配某一条**：配置 `$env:DASHSCOPE_API_KEY="sk-..."` 后运行 `node scripts/generate-voices.mjs --only=quote-rain` 即可定向覆写。

---

## 一、开场电话亭来电（`phase: intro_call`）

| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `intro-0` | `public/voice/intro-0.mp3` | 林微（清亮电话音） | 刚接通时略带惊喜与温柔，像老友久别打电话 | “喂，听得见吗？我是林微。昨晚塞进你背包里的那副眼镜，现在就在你手边吧？” |
| `intro-1` | `public/voice/intro-1.mp3` | 林微 | 强装轻松、俏皮地略微停顿，掩饰孤独 | “我在一个很远很安静的观测站值班，暂时飞不回地面，只好厚着脸皮向你借一天假期——放心，就今天一天。” |
| `intro-2` | `public/voice/intro-2.mp3` | 林微 | 充满期待与温柔，轻声引导陈舟戴上镜框 | “现在戴上那副传感镜框吧，陈舟。只要神经协议接通，你看见的太阳、碰到的野花和风，都会变成我的眼睛。” |

---

## 二、八幕主线剧情与分支回应（`quote-*` & `choice-*`）

### 第 I 幕 · 晨雾触花（06:40）
| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `quote-flower` | `public/voice/quote-flower.mp3` | 林微 | 轻呼惊喜，说完“没有天气”后声音放低微涩 | “哇——露水弹在我手背上了！我这边窗外其实没有风，也没有天气……你那边的太阳，现在照到这朵花了吗？” |
| `choice-sun-yes` | `public/voice/choice-sun-yes.mp3` | 林微 | 轻柔回味、向往水声 | “真好啊……‘晒暖’听起来好宽敞。往前带我去看看湖边吧？” |
| `choice-sun-stay` | `public/voice/choice-sun-stay.mp3` | 林微 | 带着笑意故意加快语速推开他 | “才不要耽误你休假呢！走吧，我在视野边角看见山谷下面好像有水反光了！” |

### 第 II 幕 · 湖畔听风（09:30）
| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `quote-wind` | `public/voice/quote-wind.mp3` | 林微 | 强作镇定掩饰金属异响，随后略显嘴馋发问 | “哈哈吓到你了？站里老旧压缩机总是这样吱呀乱叫，别理它。……外面的湖风吹久了，头发和衣领会变凉吧？” |
| `choice-wind-warm` | `public/voice/choice-wind-warm.mp3` | 林微 | 一丝落寞很快转为向往 | “我这里的恒温表，已经好多年没跳动过一格了。去高坡那棵孤树下面好不好？我想看蒲公英。” |
| `choice-wind-cool` | `public/voice/choice-wind-cool.mp3` | 林微 | 羡慕而克制，马上强打精神 | “真羡慕……在只有四平米见方的铁壁里，白天和夜里连风向都没有。走，往高处跑两步！” |

### 第 III 幕 · 孤树蒲公英（13:15）
| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `quote-dandelion` | `public/voice/quote-dandelion.mp3` | 林微 | 先赞叹笑出声，后困惑卡顿再匆忙圆场 | “太棒了……你看它们一直往上飞！奇怪……为什么在地面上，人一眼就能分出哪边是上、哪边是下呢？……算了，大概是我值夜班躺晕了头。” |
| `choice-seed-home` | `public/voice/choice-seed-home.mp3` | 林微 | 轻声而坚定 | “嗯！只要风没有停下来，哪怕落不回泥土里，也算替我飞出去了。” |
| `choice-lantern-tree` | `public/voice/choice-lantern-tree.mp3` | 林微 | 温柔微笑 | “木头碰撞的声音真温和呀……比舱壁上滴答作响的警报灯温柔太多了。” |

### 第 IV 幕 · 石拱回声（15:50）
| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `quote-ruin` | `public/voice/quote-ruin.mp3` | 林微 | 气息微重但依旧保持温柔亮色 | “真希望山谷里真能住着回声啊。那样我说过的每一句‘祝你好运’，就都会顺着风回到地面了。你有什么愿望，想先替我们寄存在石头里吗？” |
| `choice-wish-meet` | `public/voice/choice-wish-meet.mp3` | 林微 | 像秘密拉勾，带着一点不舍 | “这句我记下了！等这次值班结束后……不，哪怕现在，我也把它当作我们拉过勾的约定。” |
| `choice-wish-eyes` | `public/voice/choice-wish-eyes.mp3` | 林微 | 温和释然 | “这句话真好。要是以后的旅人们也在电台里互相寄风景，那就再也没人是一个人啦。” |

### 第 V 幕 · 手心晚雨（18:10）
| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `quote-rain` | `public/voice/quote-rain.mp3` | 林微 | **整段最克制却最动人**：微颤低声恳求，紧握情绪 | “陈舟……你可以伸出手去，替我摸一摸雨水吗？我好想念雨滴凉凉地落在指背上的感觉……我已经四年零七个月，没碰见过一场真正的雨了。” |
| `choice-wait-fireflies` | `public/voice/choice-wait-fireflies.mp3` | 林微 | 柔声央求走慢些 | “萤火虫也会自己发光呀……走慢一点陈舟，我想把这一夜的每一粒亮光都数清楚。” |
| `choice-wait-night` | `public/voice/choice-wait-night.mp3` | 林微 | 略带哽咽却笑着回应 | “你傻不傻……好，去岸边看看那条摇摇晃晃的小木船吧。” |

### 第 VI 幕 · 轻舟聚萤（19:45）
| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `quote-fireflies` | `public/voice/quote-fireflies.mp3` | 林微 | 平静坦然，近乎透明的温柔 | “十一年前刚进来时我每天都在哭。可今天我才知道，夜之所以会暗下来，是为了让星星和萤火亮起来。” |
| `choice-promise-share` | `public/voice/choice-promise-share.mp3` | 林微 | 认真收好约定，轻声提出最后请求 | “那可说定了——以后在几千公里下面太无聊的时候，我就翻出你的电台信箱。最后一次了，带我仰起头看看星空好吗？” |
| `choice-promise-light` | `public/voice/choice-promise-light.mp3` | 林微 | 欣慰微笑、坦然道别前兆 | “能听见你这句，我已经很赚啦。走吧陈舟，只剩最后一次抬头看星星的时间了。” |

### 第 VII 幕 · 真相揭开（22:30）
| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `quote-stars` | `public/voice/quote-stars.mp3` | 林微（深层微失真无线电） | 伪装卸下，极度温柔的坦白与告别，不能哭嚎要安静坚定 | “……对不起陈舟，根本没有什么偏远观测站。我不是在天上，我是十一年前被困在地球内核里的地航员。所以才没有风，也没有上下。但今天你给我的草原、野花、雨点和星星……足够我在黑洞般的铁镍海洋里再亮一辈子。陈舟——别哭，顺着信号看看我吧。” |
| `choice-plunge-hold` | `public/voice/choice-plunge-hold.mp3` | 林微 | 在轰鸣电流里破音却明亮的笑 | “我听见了！……我就在地球心脏跳动的地方接着看你走遍人间。三、二、一，跟紧中微子波束——！” |
| `choice-plunge-quiet` | `public/voice/choice-plunge-quiet.mp3` | 林微 | 彻底安心的长舒与笑意 | “这一刻起，我就真的再也不孤单了。再见啦，替我休假的老朋友——” |

---

## 三、地核揭示、下坠与终局（`truth`, `descent-*`, `epilogue-final`）

| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `truth` | `public/voice/truth.mp3` | 旁白 / 系统提示 | 冷峻低沉、像科幻纪录片画外音 | “落日六号失事沉入地下六千三百七十一点四公里，三百六十吉帕高压与五千四百度炽热铁镍之中。她永远无法返航。而你今天看见的所有人间晨昏，全都成了她的眼睛。” |
| `descent-0` | `public/voice/descent-0.mp3` | 陈舟 / 内心独白 | 震惊压低声音 | “莫霍面三万五千米——原来耳机另一端，一直传自地球的地下。” |
| `descent-1` | `public/voice/descent-1.mp3` | 陈舟 / 内心独白 | 沉痛且鼻音克制 | “两千九百公里下地幔……整整十一年，她睁眼看到的只有这种暗红。” |
| `descent-2` | `public/voice/descent-2.mp3` | 陈舟 / 内心独白 | 坚定、屏息迎向铁镍核心 | “六千三百七十一点四公里——林微，我看见落日六号的琥珀信标了。” |
| `epilogue-final` | `public/voice/epilogue-final.mp3` | 陈舟（主角立誓） | **全剧高光台词**：略哽咽但掷地有声、无比坚定 | “林微，从今天起我不会停下脚步——我会继续带上你的眼睛，替你看遍世间百态。” |

---

## 四、草原探索彩蛋（`egg-*`，可选）

| 音频 ID | 文件路径 | 角色 | 情绪 / 语调建议 | 配音台词原文 |
| --- | --- | --- | --- | --- |
| `egg-bottle` | `public/voice/egg-bottle.mp3` | 林微 | 早期录音留声、清澈温和 | “致偶然走来湖边的人：如果瓶身还是温的，说明今天的太阳也同样晒暖了这片山坡。无论沉到多深，我依然往有光的地方走。” |
| `egg-tablet` | `public/voice/egg-tablet.mp3` | 旁白 | 沉稳讲述 | “多年前曾有一支地面接力组，每天傍晚把草原的风声通过电缆发往深井。后来信道早被地幔熔断，但路过的人仍习惯把野花放在碑前。” |
| `egg-meteor` | `public/voice/egg-meteor.mp3` | 林微 | 悄悄俏皮、近耳低语 | “其实她早听见你抬头那一秒的心跳了。越是不肯说出口的愿望，夜空越亮着替你们保管。” |
