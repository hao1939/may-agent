# Changelog

## [5.4.1](https://github.com/hao1939/may-agent/compare/v5.4.0...v5.4.1) (2026-10-03)


### Bug Fixes

* **runtime:** reserve time to submit results before timeout ([#308](https://github.com/hao1939/may-agent/issues/308)) ([e23ed14](https://github.com/hao1939/may-agent/commit/e23ed14bc5e103d3e671f88ec379861b8c2d9c75))
* **tasks:** accept explicitly covered outstanding input ([#313](https://github.com/hao1939/may-agent/issues/313)) ([1bb35ac](https://github.com/hao1939/may-agent/commit/1bb35ac1e42fe10cdf17f79c9bc57b1cff36b79c))
* **tasks:** retain dirty workspace results ([#309](https://github.com/hao1939/may-agent/issues/309)) ([e0979a4](https://github.com/hao1939/may-agent/commit/e0979a4f954c809421e8ddf917ba37f72792c7d1))
* **usage:** record persistent chat replies and recover interrupted accounting ([#307](https://github.com/hao1939/may-agent/issues/307)) ([24da472](https://github.com/hao1939/may-agent/commit/24da4722dc6212cae684975184f4a862837b3985))

## [5.4.0](https://github.com/hao1939/may-agent/compare/v5.3.0...v5.4.0) (2026-10-03)


### Features

* **diagnostics:** expose SQLite cost and recent slow queries ([#282](https://github.com/hao1939/may-agent/issues/282)) ([dc92e4f](https://github.com/hao1939/may-agent/commit/dc92e4f516a848fc0a506c59b04952fe5e7bccdd))
* **metrics:** separate sample collection from rule evaluation ([#301](https://github.com/hao1939/may-agent/issues/301)) ([ae781f9](https://github.com/hao1939/may-agent/commit/ae781f932fe43d81b6be9a8424feb684bc6ec58e))
* **skills:** discover manuals from configured directories ([#291](https://github.com/hao1939/may-agent/issues/291)) ([5608d4d](https://github.com/hao1939/may-agent/commit/5608d4d599cc73ce57bc98620f51c99a64f6a122))


### Bug Fixes

* **apps:** trust exact source pin during release staging ([#287](https://github.com/hao1939/may-agent/issues/287)) ([780f214](https://github.com/hao1939/may-agent/commit/780f2145fd4f07284b025aa0cedf01f57148cfb6))
* **codex:** resume long conversations without loading their full history ([#288](https://github.com/hao1939/may-agent/issues/288)) ([e379a2b](https://github.com/hao1939/may-agent/commit/e379a2bebd183e9f4c08bd5bc044e51fe4309a90))
* **conversation:** admit linked outcomes without duplicate events ([#304](https://github.com/hao1939/may-agent/issues/304)) ([e2486a6](https://github.com/hao1939/may-agent/commit/e2486a6c7e8474737756c8a02e5794355f8727d8))
* **conversation:** expose selectable generation identities ([#296](https://github.com/hao1939/may-agent/issues/296)) ([4031c70](https://github.com/hao1939/may-agent/commit/4031c7027c25475229d61cab11dfe49e98684bf4))
* **conversation:** index recovery admission lookups by task ([#280](https://github.com/hao1939/may-agent/issues/280)) ([04b13a3](https://github.com/hao1939/may-agent/commit/04b13a3c72138cfd970068efbd9e5ad008ba4efb))
* **conversation:** keep automated reviews quiet and context focused ([#277](https://github.com/hao1939/may-agent/issues/277)) ([ebe39a5](https://github.com/hao1939/may-agent/commit/ebe39a5f65fa5485f858d49d375061cbb071b977))
* **conversation:** return validation errors before finish ([#297](https://github.com/hao1939/may-agent/issues/297)) ([438ad1e](https://github.com/hao1939/may-agent/commit/438ad1e38bd89a4444061a7d76483a0a6f1bdba0))
* **execution:** end ordinary helper invocations after finish ([#281](https://github.com/hao1939/may-agent/issues/281)) ([7b5f64d](https://github.com/hao1939/may-agent/commit/7b5f64dcac092f76fb831f7ef36dfcc3f00d8263))
* **inbox:** stop republishing unchanged dependency reports ([#302](https://github.com/hao1939/may-agent/issues/302)) ([6c88dce](https://github.com/hao1939/may-agent/commit/6c88dceb816de6fa81534d8ded0d05e961a62f8a))
* **metrics:** expose stale collectors and close retired alerts ([#306](https://github.com/hao1939/may-agent/issues/306)) ([deb8cfc](https://github.com/hao1939/may-agent/commit/deb8cfcccb3ee2d6aa8cd91bb0a503fbfbdaca3a))
* **metrics:** index accepted-decision evidence reads ([#278](https://github.com/hao1939/may-agent/issues/278)) ([c522be2](https://github.com/hao1939/may-agent/commit/c522be2ab3ce07b47e3b169ebdbdf65d6e62c144))
* **metrics:** keep one open alert and publish committed transitions ([#300](https://github.com/hao1939/may-agent/issues/300)) ([0af94fe](https://github.com/hao1939/may-agent/commit/0af94fe2087df5a57c988de252dbf5970d62991d))
* **metrics:** run metric SQL on a read-only database connection ([#286](https://github.com/hao1939/may-agent/issues/286)) ([1375386](https://github.com/hao1939/may-agent/commit/13753868b47fac21d15d2056c2ace3f7dc9ca0a2))
* **tasks:** accept scoped progress while input remains ([#305](https://github.com/hao1939/may-agent/issues/305)) ([63873ff](https://github.com/hao1939/may-agent/commit/63873ffd36fa0a0f9e81b03765ffba9a5257c8f2))
* **tasks:** avoid redundant agent attempts ([#295](https://github.com/hao1939/may-agent/issues/295)) ([8fa6edd](https://github.com/hao1939/may-agent/commit/8fa6eddc2f540ae0bf68ff1327b773397661a986))
* **tasks:** avoid repeated report lookups during conversation recovery ([#294](https://github.com/hao1939/may-agent/issues/294)) ([1449124](https://github.com/hao1939/may-agent/commit/14491241d07346c7993c99bd6a709e29797d2883))
* **tasks:** avoid request scans when finding human actions ([#292](https://github.com/hao1939/may-agent/issues/292)) ([0bd3e89](https://github.com/hao1939/may-agent/commit/0bd3e894f5d3fd75e2d5a818ae3e06d3f996cefc))
* **tasks:** index requester condition routes ([#283](https://github.com/hao1939/may-agent/issues/283)) ([9aedf2d](https://github.com/hao1939/may-agent/commit/9aedf2dd80c88d71655f34a7402944e9113a241c))
* **tasks:** preserve unfinished work in execution context ([#303](https://github.com/hao1939/may-agent/issues/303)) ([2872635](https://github.com/hao1939/may-agent/commit/28726352201f52abc32bd0ac9337f7aaf1296944))
* **tasks:** restore Codex execution and keep correction requests reachable ([#284](https://github.com/hao1939/may-agent/issues/284)) ([0317016](https://github.com/hao1939/may-agent/commit/0317016b67ade1cce2e083cee3c80ac36a7e1821))
* **tasks:** route App requests through shared Task admission ([#285](https://github.com/hao1939/may-agent/issues/285)) ([797c7ee](https://github.com/hao1939/may-agent/commit/797c7ee3565be37daa070e28af5ce2ae511a43dd))
* **tasks:** stop repeated agent calls for unchanged waits ([#293](https://github.com/hao1939/may-agent/issues/293)) ([b595f65](https://github.com/hao1939/may-agent/commit/b595f65a98134dd677241a60b8769839a2206538))
* **telegram:** stop repeating unchanged action notices ([#290](https://github.com/hao1939/may-agent/issues/290)) ([f2eb4b8](https://github.com/hao1939/may-agent/commit/f2eb4b87683ee92b048bb9fc8fe627fd76d0b4ac))
* **workflows:** enforce one common execution deadline ([#289](https://github.com/hao1939/may-agent/issues/289)) ([e2e5c84](https://github.com/hao1939/may-agent/commit/e2e5c848122a6b1ce1a916764b20b27e9d24abcc))


### Performance Improvements

* **tasks:** speed up Task request lookups ([#299](https://github.com/hao1939/may-agent/issues/299)) ([d101f08](https://github.com/hao1939/may-agent/commit/d101f08d788d167274d2010073e0f110892a9ce5))

## [5.3.0](https://github.com/hao1939/may-agent/compare/v5.2.0...v5.3.0) (2026-09-30)


### Features

* **metrics:** expose trend evidence and retained breach decisions ([#274](https://github.com/hao1939/may-agent/issues/274)) ([e8b56e1](https://github.com/hao1939/may-agent/commit/e8b56e17e7f7dc3c5575b8df3861a1dfc69948fa))
* **observers:** connect Task waits to App resource detectors ([#270](https://github.com/hao1939/may-agent/issues/270)) ([dc6395d](https://github.com/hao1939/may-agent/commit/dc6395dbccd0c1d7d2e95356859d9a9aec952734))


### Bug Fixes

* **conversation:** allow Task references without prior attachment ([#267](https://github.com/hao1939/may-agent/issues/267)) ([91328f7](https://github.com/hao1939/may-agent/commit/91328f7a62b8ad01bfc069a1d943b679e7a85a75))
* **conversation:** present the whole input batch before reply routing ([#264](https://github.com/hao1939/may-agent/issues/264)) ([edc43e1](https://github.com/hao1939/may-agent/commit/edc43e16b481e88ef1cca67dffb68dd1e4dd76f7))
* **conversation:** share reply validation between execution and settlement ([#258](https://github.com/hao1939/may-agent/issues/258)) ([e3dd4a5](https://github.com/hao1939/may-agent/commit/e3dd4a59de20b89b57473b6f128f2828f9655f8c))
* **conversations:** preserve accepted Requests across input batches ([#272](https://github.com/hao1939/may-agent/issues/272)) ([0c9c29b](https://github.com/hao1939/may-agent/commit/0c9c29b066935207819b4d5e042793cded1f4c1b))
* **events:** preserve event metadata across storage and retries ([#263](https://github.com/hao1939/may-agent/issues/263)) ([6c85691](https://github.com/hao1939/may-agent/commit/6c856911211031d291d94e552c4069bfa03a30eb))
* **health:** label session completion separately from task success ([#260](https://github.com/hao1939/may-agent/issues/260)) ([ca2253b](https://github.com/hao1939/may-agent/commit/ca2253b7521bb0699b48f0342292443b53a74d94))
* **inputs:** share approval handling across Telegram and Console ([#275](https://github.com/hao1939/may-agent/issues/275)) ([3bda262](https://github.com/hao1939/may-agent/commit/3bda26289b91fe8407933998d5c938acac5e3c19))
* **tasks:** centralize attempt setup and cleanup ([#265](https://github.com/hao1939/may-agent/issues/265)) ([96ce2f8](https://github.com/hao1939/may-agent/commit/96ce2f8d05dea874caf17584a9ddb3b193de0080))
* **tasks:** expose the scheduler condition review deadline ([#259](https://github.com/hao1939/may-agent/issues/259)) ([74f12b9](https://github.com/hao1939/may-agent/commit/74f12b9c057e4f6b00bc7e46bb62888b8d222f95))
* **tasks:** keep assigned input visible in context previews ([#268](https://github.com/hao1939/may-agent/issues/268)) ([c9fec72](https://github.com/hao1939/may-agent/commit/c9fec72407f07ab795e307873d2200fbd9373eca))
* **tasks:** reopen with new input and retain late observations ([#271](https://github.com/hao1939/may-agent/issues/271)) ([a5df00b](https://github.com/hao1939/may-agent/commit/a5df00ba628f16848d15118cc073c1db49f51bc4))
* **tasks:** settle only the requests a worker answers ([#269](https://github.com/hao1939/may-agent/issues/269)) ([de59c8d](https://github.com/hao1939/may-agent/commit/de59c8dae911c8a4e39c925d619164128610301a))
* **tasks:** share execution context and Task reads ([#266](https://github.com/hao1939/may-agent/issues/266)) ([65741c7](https://github.com/hao1939/may-agent/commit/65741c756a05f3896c988e94005e2f6cd2ad59dd))
* **web:** read loaded Apps from the existing runtime catalog ([#273](https://github.com/hao1939/may-agent/issues/273)) ([c5529b3](https://github.com/hao1939/may-agent/commit/c5529b38fcca9471534be0f5b62f310130580c91))

## [5.2.0](https://github.com/hao1939/may-agent/compare/v5.1.0...v5.2.0) (2026-09-27)


### Features

* **reporting:** expose task attempt populations and execution links ([#257](https://github.com/hao1939/may-agent/issues/257)) ([5474e22](https://github.com/hao1939/may-agent/commit/5474e2209f3fc6638eb4bc71e3e642afe31967d9))


### Bug Fixes

* **conversation:** derive active turns from current Task attempts ([#235](https://github.com/hao1939/may-agent/issues/235)) ([6afa50a](https://github.com/hao1939/may-agent/commit/6afa50a9111d7047d9afe90b598c314c2536534c))
* **events:** recover App routing after translation failures ([#254](https://github.com/hao1939/may-agent/issues/254)) ([ed70d7e](https://github.com/hao1939/may-agent/commit/ed70d7e844690db934aa1a0528d379f2515a37f1))
* **maintenance:** preserve declared event metadata ([#240](https://github.com/hao1939/may-agent/issues/240)) ([63dc0fe](https://github.com/hao1939/may-agent/commit/63dc0fed60ca30157814546ea7be5a33aec64047))
* **release:** test the built image before publishing ([#249](https://github.com/hao1939/may-agent/issues/249)) ([671b690](https://github.com/hao1939/may-agent/commit/671b6900932767f639323b8fc701628b27740866))
* **tools:** remove misleading options and retain exact session IDs ([#237](https://github.com/hao1939/may-agent/issues/237)) ([fc08f9f](https://github.com/hao1939/may-agent/commit/fc08f9fa74bb4c2de2a0636b9c5aa8ac7c6551e2))

## [5.1.0](https://github.com/hao1939/may-agent/compare/v5.0.1...v5.1.0) (2026-09-22)


### Features

* **models:** add experimental DeepSeek option ([#224](https://github.com/hao1939/may-agent/issues/224)) ([1c04195](https://github.com/hao1939/may-agent/commit/1c04195bd5ae48f30817bd21b762b01f976ee7c5))


### Bug Fixes

* **apps:** expose input contracts and explain rejected requests ([#225](https://github.com/hao1939/may-agent/issues/225)) ([941d003](https://github.com/hao1939/may-agent/commit/941d0036db2c06a1cf4a95b910be687c4385a8a1))
* **execution:** report the tools available to direct runs ([#223](https://github.com/hao1939/may-agent/issues/223)) ([efddecb](https://github.com/hao1939/may-agent/commit/efddecb4cb9dd5eace619e8783be6ed9cbfe01a9))
* preserve app input validation diagnostics ([#226](https://github.com/hao1939/may-agent/issues/226)) ([2004991](https://github.com/hao1939/may-agent/commit/20049916b79d2ba2d2265edf5eeb605ff0e59c05))
* **tasks:** separate completion cleanup from cancellation ([#227](https://github.com/hao1939/may-agent/issues/227)) ([17a7cda](https://github.com/hao1939/may-agent/commit/17a7cdaef016c2d0e4a15daddbf6ca1fe3f0300c))
* **telegram:** reduce duplicate alerts and distinguish human actions ([#221](https://github.com/hao1939/may-agent/issues/221)) ([1283ea7](https://github.com/hao1939/may-agent/commit/1283ea7ad900aa8f679658b5e61f3db878e58d34))

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
