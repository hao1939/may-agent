# Changelog

## [5.0.1](https://github.com/hao1939/may-agent/compare/v5.0.0...v5.0.1) (2026-09-20)


### Bug Fixes

* **deploy:** allow deployment without an App task ([#220](https://github.com/hao1939/may-agent/issues/220)) ([3f9c46a](https://github.com/hao1939/may-agent/commit/3f9c46a2e82e3ed12bab1094e5d18ad30f6ad47f))
* **tasks:** expose older accepted evidence through Task reads ([#214](https://github.com/hao1939/may-agent/issues/214)) ([04eea27](https://github.com/hao1939/may-agent/commit/04eea2766aa897b0797eaa2f40cfb96fb3dcacc9))
* **tasks:** honor explicit condition schedule updates ([#217](https://github.com/hao1939/may-agent/issues/217)) ([423fb0b](https://github.com/hao1939/may-agent/commit/423fb0b813c86c37d144a84937f7b420ebcef9fe))
* **tasks:** keep unfinished work recoverable across handoffs ([#210](https://github.com/hao1939/may-agent/issues/210)) ([3294803](https://github.com/hao1939/may-agent/commit/32948031e354ec48c9733429ec0db0df87fb0c8e))
* **tasks:** pace retained condition reviews ([#218](https://github.com/hao1939/may-agent/issues/218)) ([fabdb94](https://github.com/hao1939/may-agent/commit/fabdb94bb324be8f02d29394a92e043faec547d1))
* **tasks:** query global human actions directly ([#216](https://github.com/hao1939/may-agent/issues/216)) ([765bc0b](https://github.com/hao1939/may-agent/commit/765bc0b5c6adf5cacad00de2600fd0f2a6cdfe30))
* **telegram:** add colored task state markers ([#215](https://github.com/hao1939/may-agent/issues/215)) ([27a1980](https://github.com/hao1939/may-agent/commit/27a1980a7777636163eeb76e7a2a60caf72f60a1))
* **telegram:** make task lists readable and show scheduled recurrence ([#213](https://github.com/hao1939/may-agent/issues/213)) ([834cb27](https://github.com/hao1939/may-agent/commit/834cb27557a99f04c4c3f2b18e58b1d69485cca2))

## [5.0.0](https://github.com/hao1939/may-agent/compare/v4.0.0...v5.0.0) (2026-09-19)


### ⚠ BREAKING CHANGES

* **tasks:** use App input as the complete handoff ([#194](https://github.com/hao1939/may-agent/issues/194))
* **web:** route project comments through normal App input ([#176](https://github.com/hao1939/may-agent/issues/176))
* **runtime:** decouple admission from execution ([#191](https://github.com/hao1939/may-agent/issues/191))
* **tasks:** unify requirement corrections under creator authority ([#188](https://github.com/hao1939/may-agent/issues/188))

### Features

* **execution:** add experimental configured context preparation ([#192](https://github.com/hao1939/may-agent/issues/192)) ([83a2743](https://github.com/hao1939/may-agent/commit/83a27430794abf49a5ebb3f14a58af387bb8cccb))
* **metrics:** compare context preparation usage and outcomes ([#193](https://github.com/hao1939/may-agent/issues/193)) ([45d6bd2](https://github.com/hao1939/may-agent/commit/45d6bd2e751174d5f6355bbbc62041c163fb2b3e))
* **runtime:** bind approvals and activation to exact Task evidence ([#197](https://github.com/hao1939/may-agent/issues/197)) ([0d25ab1](https://github.com/hao1939/may-agent/commit/0d25ab157ad7de6693be46781ca65a8341017804))


### Bug Fixes

* **checkpoint:** preserve numbering across process restarts ([#198](https://github.com/hao1939/may-agent/issues/198)) ([28670dd](https://github.com/hao1939/may-agent/commit/28670dd2807eec91ffa27875d2eb8f386316d3b9))
* **execution:** publish shared Task context and recovery baseline ([#196](https://github.com/hao1939/may-agent/issues/196)) ([0fcc420](https://github.com/hao1939/may-agent/commit/0fcc42051d255119366c69d9fd3e3fed4e9cc18c))
* **inbox:** reject misrouted input before it blocks a conversation ([#202](https://github.com/hao1939/may-agent/issues/202)) ([71f04d4](https://github.com/hao1939/may-agent/commit/71f04d45d63c277c740ba727120aa138137fa080))
* **runtime:** decouple admission from execution ([#191](https://github.com/hao1939/may-agent/issues/191)) ([efb98b5](https://github.com/hao1939/may-agent/commit/efb98b5b32ac2212273d822a882deae659f0fd36))
* **runtime:** keep task worker role process-local ([#199](https://github.com/hao1939/may-agent/issues/199)) ([f6ab8e1](https://github.com/hao1939/may-agent/commit/f6ab8e18b16a42197519c2485a81d9d15fd0a3b8))
* **state:** recover a stuck Conversation input offline ([#203](https://github.com/hao1939/may-agent/issues/203)) ([7fc90f5](https://github.com/hao1939/may-agent/commit/7fc90f57829ad6a8ddd48eb3de8489e527314cf5))
* **tasks:** mark recurring tasks without hiding human decisions ([#200](https://github.com/hao1939/may-agent/issues/200)) ([ecbf886](https://github.com/hao1939/may-agent/commit/ecbf886f8292c804544481806674b6aaf827ab0a))
* **tasks:** preserve independent waits and deferred reviews ([#209](https://github.com/hao1939/may-agent/issues/209)) ([5143799](https://github.com/hao1939/may-agent/commit/5143799ded84b2351749a0cd8d5a2178ed272a87))
* **tasks:** unify requirement corrections under creator authority ([#188](https://github.com/hao1939/may-agent/issues/188)) ([708a9db](https://github.com/hao1939/may-agent/commit/708a9dbdfedc4b8ce4d7bedceb28ee7ceab5f197))
* **tasks:** use App input as the complete handoff ([#194](https://github.com/hao1939/may-agent/issues/194)) ([dd548ca](https://github.com/hao1939/may-agent/commit/dd548cabe2bf88ba427de2d29fdde3e94b7050c5))
* **web:** route project comments through normal App input ([#176](https://github.com/hao1939/may-agent/issues/176)) ([bf001b4](https://github.com/hao1939/may-agent/commit/bf001b48ad169e828c1713d959a5a524c2d198c6))
* **workflows:** expose creator-authorized task revisions ([#195](https://github.com/hao1939/may-agent/issues/195)) ([9c7ee8c](https://github.com/hao1939/may-agent/commit/9c7ee8c65a1efeb09956db65101c4d79b20e15b6))

## [4.0.0](https://github.com/hao1939/may-agent/compare/v3.0.1...v4.0.0) (2026-09-13)


### ⚠ BREAKING CHANGES

* **execution:** unify helper ownership and execution limits ([#186](https://github.com/hao1939/may-agent/issues/186))

### Code Refactoring

* **execution:** unify helper ownership and execution limits ([#186](https://github.com/hao1939/may-agent/issues/186)) ([91ed9ca](https://github.com/hao1939/may-agent/commit/91ed9ca6a0680786c2eea69c1ae5b767febe616e))

## [3.0.1](https://github.com/hao1939/may-agent/compare/v3.0.0...v3.0.1) (2026-09-12)


### Bug Fixes

* **tasks:** back off prolonged execution failures to one hour ([#183](https://github.com/hao1939/may-agent/issues/183)) ([a473990](https://github.com/hao1939/may-agent/commit/a473990026436d43b1268eceff3038fad94e4aaa))
* **tasks:** keep control commands out of task wake admission ([#182](https://github.com/hao1939/may-agent/issues/182)) ([54c72b6](https://github.com/hao1939/may-agent/commit/54c72b67031c7c8b1fce095438c2b91a7c20c5c5))

## [3.0.0](https://github.com/hao1939/may-agent/compare/v2.0.0...v3.0.0) (2026-09-12)


### ⚠ BREAKING CHANGES

* **core:** simplify Task contracts and runtime boundaries ([#168](https://github.com/hao1939/may-agent/issues/168))
* **tasks:** replace implicit parent coordination with explicit returns ([#164](https://github.com/hao1939/may-agent/issues/164))

### Features

* **tasks:** return caller feedback while retaining durable waits ([#169](https://github.com/hao1939/may-agent/issues/169)) ([b1c7cbe](https://github.com/hao1939/may-agent/commit/b1c7cbef5a6efea5f494d2a44e4f9e861ab0dc59))


### Bug Fixes

* **recovery:** leave bounded call failures with their caller ([#178](https://github.com/hao1939/may-agent/issues/178)) ([7ee4aac](https://github.com/hao1939/may-agent/commit/7ee4aac642633753001199e30a1a5a057631f19f))
* **scripts:** preserve truthful results and read-only inspection ([#172](https://github.com/hao1939/may-agent/issues/172)) ([f6a11d1](https://github.com/hao1939/may-agent/commit/f6a11d1c7d4dbbf9164fa99ba208b05670a6d6b4))
* **tasks:** prevent duplicate wakes across workers and recovery ([#175](https://github.com/hao1939/may-agent/issues/175)) ([e38d286](https://github.com/hao1939/may-agent/commit/e38d2861f36803acaeadfaffe11b1efe3af749dd))
* **tasks:** simplify workflow results and replay published facts ([#167](https://github.com/hao1939/may-agent/issues/167)) ([38a048d](https://github.com/hao1939/may-agent/commit/38a048da5c105bea91dc7163010d94483a60b747))


### Code Refactoring

* **core:** simplify Task contracts and runtime boundaries ([#168](https://github.com/hao1939/may-agent/issues/168)) ([c0cbb59](https://github.com/hao1939/may-agent/commit/c0cbb59e7245924e50ac0d2c6cd5a82232418964))
* **tasks:** replace implicit parent coordination with explicit returns ([#164](https://github.com/hao1939/may-agent/issues/164)) ([8026aff](https://github.com/hao1939/may-agent/commit/8026aff97585edd7f728fa4ce360fdde71bc740a))

## [2.0.0](https://github.com/hao1939/may-agent/compare/v1.1.0...v2.0.0) (2026-09-12)


### ⚠ BREAKING CHANGES

* **tasks:** unify conversation and delegated work execution ([#158](https://github.com/hao1939/may-agent/issues/158))

### Bug Fixes

* **agents:** distinguish finish reports from behavior adoption ([#161](https://github.com/hao1939/may-agent/issues/161)) ([4598a53](https://github.com/hao1939/may-agent/commit/4598a53b84818daa59d020b30c79406fdd64c6d5))
* **workflows:** cancel cooperative I/O and retain returned evidence ([#159](https://github.com/hao1939/may-agent/issues/159)) ([fa9b683](https://github.com/hao1939/may-agent/commit/fa9b683b01716251d0ec52c3166a9d06493a699b))


### Code Refactoring

* **tasks:** unify conversation and delegated work execution ([#158](https://github.com/hao1939/may-agent/issues/158)) ([f5d5a53](https://github.com/hao1939/may-agent/commit/f5d5a5357b2330285b70099d2d8f76339d875b9b))

## [1.1.0](https://github.com/hao1939/may-agent/compare/v1.0.0...v1.1.0) (2026-09-11)


### Features

* **metrics:** show truthful workflow health and run evidence ([#147](https://github.com/hao1939/may-agent/issues/147)) ([3e9db14](https://github.com/hao1939/may-agent/commit/3e9db1422764736d9751e4ffc1255092e533e25d))


### Bug Fixes

* **metrics:** tolerate bounded startup write contention ([#151](https://github.com/hao1939/may-agent/issues/151)) ([05b939b](https://github.com/hao1939/may-agent/commit/05b939b0e24e501395bfaebc556957187d75dc3b))
* **models:** preserve optional Responses tool fields ([#152](https://github.com/hao1939/may-agent/issues/152)) ([f614edb](https://github.com/hao1939/may-agent/commit/f614edbb7e9f6507ea5c6bb3ee489715155eb102))
* **observers:** preserve feedback until facts are published ([#156](https://github.com/hao1939/may-agent/issues/156)) ([a8f6518](https://github.com/hao1939/may-agent/commit/a8f6518855aa5f85a697468665269124dda30479))
* **tasks:** keep session adapters aligned with accepted runtime ([#145](https://github.com/hao1939/may-agent/issues/145)) ([5857529](https://github.com/hao1939/may-agent/commit/5857529effc31857dc2e5bd44e89e38cf5e5323c))
* **telegram:** preserve input, reply context, and reload results ([#157](https://github.com/hao1939/may-agent/issues/157)) ([6fbc49a](https://github.com/hao1939/may-agent/commit/6fbc49a6c3d79df52655c8a97ec8277782337770))

## [1.0.0](https://github.com/hao1939/may-agent/compare/v0.3.0...v1.0.0) (2026-09-11)


### ⚠ BREAKING CHANGES

* **conversations:** retire child-result waits ([#140](https://github.com/hao1939/may-agent/issues/140))

### Features

* **workflows:** retain run evidence and report execution outcomes ([#143](https://github.com/hao1939/may-agent/issues/143)) ([939698a](https://github.com/hao1939/may-agent/commit/939698ad6719d7b2bebffc4983cb1102690cf39e))


### Bug Fixes

* **guards:** remove unsupported file-content claim ([#132](https://github.com/hao1939/may-agent/issues/132)) ([23968ac](https://github.com/hao1939/may-agent/commit/23968acd6364cc2247fb4c95503ca48b041ecb07))
* **loader:** preserve shared tools in App definition snapshots ([#134](https://github.com/hao1939/may-agent/issues/134)) ([9320136](https://github.com/hao1939/may-agent/commit/9320136db34a4069726c7ede093ef282261d24b0))
* **tasks:** show queued maintained cycles consistently ([#136](https://github.com/hao1939/may-agent/issues/136)) ([6716221](https://github.com/hao1939/may-agent/commit/671622102cac3fe1c1e3983fb3053f04e28c1e18))
* **telegram:** bound requests and cancel I/O on close ([#133](https://github.com/hao1939/may-agent/issues/133)) ([39a23f2](https://github.com/hao1939/may-agent/commit/39a23f221e1c9b104468147a45b72b901754ee2d))


### Code Refactoring

* **conversations:** retire child-result waits ([#140](https://github.com/hao1939/may-agent/issues/140)) ([335bf17](https://github.com/hao1939/may-agent/commit/335bf1782cd09372df2c70a42c495f9166d0a2f7))

## [0.3.0](https://github.com/hao1939/may-agent/compare/v0.2.0...v0.3.0) (2026-09-10)


### Features

* **apps:** skip Apps marked .disabled ([#116](https://github.com/hao1939/may-agent/issues/116)) ([d0231db](https://github.com/hao1939/may-agent/commit/d0231db630e82724e79b6e909027bbd0b70366b6))


### Bug Fixes

* **core:** bound input retries and cancel pending dispatch on close ([#127](https://github.com/hao1939/may-agent/issues/127)) ([743aa5d](https://github.com/hao1939/may-agent/commit/743aa5dedd6fcea5219fa006d87553c3d942271b))
* **core:** contain input failures and simplify turn controls ([#121](https://github.com/hao1939/may-agent/issues/121)) ([ed56e38](https://github.com/hao1939/may-agent/commit/ed56e38ba354879567bbee9557ac1928ea1255ac))
* **release:** link published image from GitHub release ([#117](https://github.com/hao1939/may-agent/issues/117)) ([b81a5d6](https://github.com/hao1939/may-agent/commit/b81a5d622bd1d2990d483d1b536a228b4f9b3157))
* **tasks:** preserve exact cross-App reads in isolated workers ([#119](https://github.com/hao1939/may-agent/issues/119)) ([7682f3b](https://github.com/hao1939/may-agent/commit/7682f3bb3ef57992c943e34b21cba7d1330740c0))
* **tools:** preserve filesystem access errors during edits ([#128](https://github.com/hao1939/may-agent/issues/128)) ([0d8c765](https://github.com/hao1939/may-agent/commit/0d8c76585414359917569aea5f7c2f61a4a22840))

## [0.2.0](https://github.com/hao1939/may-agent/compare/v0.1.1...v0.2.0) (2026-09-10)


### Features

* **conversation:** track accepted asks and bound turn handling ([#112](https://github.com/hao1939/may-agent/issues/112)) ([7437d7a](https://github.com/hao1939/may-agent/commit/7437d7a3f4a0d9282680ae3cc6cf3fcae4d58df3))
* **tasks:** stop App work without claiming success ([#111](https://github.com/hao1939/may-agent/issues/111)) ([cdcb008](https://github.com/hao1939/may-agent/commit/cdcb008b8227492e9e0be48c881a4a0f20d4a9ee))


### Bug Fixes

* **release:** publish image after Release Please ([#91](https://github.com/hao1939/may-agent/issues/91)) ([b94b4cc](https://github.com/hao1939/may-agent/commit/b94b4ccf3fc6fd7adf95571b50300b5f7b2daad5))
* **runtime:** start Tasks independently of optional schedules ([#96](https://github.com/hao1939/may-agent/issues/96)) ([82593a7](https://github.com/hao1939/may-agent/commit/82593a79ebbad139a7534eddb02a72ef82e84d74))
* **storage:** atomically attach requests and persist Task wakes ([#108](https://github.com/hao1939/may-agent/issues/108)) ([569e4da](https://github.com/hao1939/may-agent/commit/569e4da02bb5b87972ed41e5527ff6eb702867a6))
* **tasks:** durably wake requests after retry exhaustion ([#109](https://github.com/hao1939/may-agent/issues/109)) ([4afaaaf](https://github.com/hao1939/may-agent/commit/4afaaafbca7851c6bd554aca035f068f295aa235))
* **tasks:** enforce retry limits across recovery and restart ([#107](https://github.com/hao1939/may-agent/issues/107)) ([dd876fc](https://github.com/hao1939/may-agent/commit/dd876fc38e3a1e3a41683e7addc236127cfcf47e))
* **tasks:** preserve checked completion after interruption ([#104](https://github.com/hao1939/may-agent/issues/104)) ([d9e7597](https://github.com/hao1939/may-agent/commit/d9e7597e93608c45bed4fe649ff1b0fb1d040743))
* **tasks:** separate handler availability from recovery ([#98](https://github.com/hao1939/may-agent/issues/98)) ([88598a1](https://github.com/hao1939/may-agent/commit/88598a1576aa5708254f59a243af6af7f6dc4b34))
* **tasks:** share settlement across normal and recovered attempts ([#106](https://github.com/hao1939/may-agent/issues/106)) ([edf9112](https://github.com/hao1939/may-agent/commit/edf9112da48bf6e5326620e7283d7c35aa8232f8))

## [0.1.1](https://github.com/hao1939/may-agent/compare/v0.1.0...v0.1.1) (2026-09-08)


### Bug Fixes

* **ci:** keep private webhook data out of build publications ([b01af9a](https://github.com/hao1939/may-agent/commit/b01af9a969de277067115d9491574c4efb2954ec))
* **ci:** keep private webhook data out of build publications ([#88](https://github.com/hao1939/may-agent/issues/88)) ([01dea18](https://github.com/hao1939/may-agent/commit/01dea186267981cb8ccb56730a887ddc5b81c247))
* **may:** align conversation context with direct Task handoff ([aeceb84](https://github.com/hao1939/may-agent/commit/aeceb8452174901b04f6c2320fe76f40d2befa99))
* **may:** align conversational handoff with the focused May design ([9cf22cf](https://github.com/hao1939/may-agent/commit/9cf22cff66d2067d52c3e289e22bf6a0519b6526))
* **may:** allow bounded direct work in conversational turns ([f16bbdc](https://github.com/hao1939/may-agent/commit/f16bbdc8d3dc294d9bc6efc147274993e9041444))
* **may:** let conversation do bounded work without forced handoff ([7466dd5](https://github.com/hao1939/may-agent/commit/7466dd5a10c62bd16a1961298287d44f454b473c))
* **privacy:** finish fixture sanitization and bound Git checks ([#87](https://github.com/hao1939/may-agent/issues/87)) ([a57fd7f](https://github.com/hao1939/may-agent/commit/a57fd7fa90ed0f52ed9437ffded9622b92478b73))
* **privacy:** remove installation details and guard publication ([#86](https://github.com/hao1939/may-agent/issues/86)) ([e3e81db](https://github.com/hao1939/may-agent/commit/e3e81db81df60073ddd361348cb43e66b9c554c4))
* **release:** bound initial Release Please history ([#84](https://github.com/hao1939/may-agent/issues/84)) ([e0b5825](https://github.com/hao1939/may-agent/commit/e0b58255f07f5a305ef9deb48fb5696748e06931))
* **tasks:** isolate workspace fetches from worker Git refs ([#80](https://github.com/hao1939/may-agent/issues/80)) ([1ad273d](https://github.com/hao1939/may-agent/commit/1ad273dfd06ba683e00523ba970f7f11b08cd00c))
* **tasks:** keep proposed actions out of diagnostic results ([3bf2c82](https://github.com/hao1939/may-agent/commit/3bf2c82940ca9f9c7aa99cd251c7e6fa72a500ea))
* **tasks:** preserve completed work across new facts ([985edeb](https://github.com/hao1939/may-agent/commit/985edeb3d18a6c45e42e4ba6c08f35cc8d34768c))
* **tasks:** preserve completed work when new facts arrive ([a4d0f3b](https://github.com/hao1939/may-agent/commit/a4d0f3b9236ebb2adf6f8fe68f63071e2c883184))
* **tasks:** retry fenced persistence without repeating execution ([243aacc](https://github.com/hao1939/may-agent/commit/243aacccff033140948a36a204906b2dc4ad4b12))
* **workflows:** preserve Task binding in agent calls ([#81](https://github.com/hao1939/may-agent/issues/81)) ([af63774](https://github.com/hao1939/may-agent/commit/af63774f03538b85391b80fcc982381b5f81e5d9))
