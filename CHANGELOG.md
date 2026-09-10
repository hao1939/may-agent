# Changelog

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
