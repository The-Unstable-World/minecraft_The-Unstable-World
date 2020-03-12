function list_assert_one(xs){
  if(xs.length!==1){throw `length (${xs.length}) isn't 1`}
  return xs[0]}
function lines(x){
  return x.split("\n").filter(x=>x!='')}
// https://stackoverflow.com/questions/34887973/how-to-create-a-partition-function-in-javascript-using-the-following-guidelines/34890630#34890630
function partition(arr, filter) {
  var fail = [];
  var pass = arr.filter((e, i, a) => {
    if (filter(e, i, a)) return true;
    fail.push(e);
  });
  return [pass, fail];
}

const request = require('cloudscraper')
const { get } = request
const { JSDOM } = require('jsdom')
const fs = require('fs')
const util = require('util')
const shell = require('shelljs')
const isZip = util.promisify(require('is-zip-file').isZip)
const parseXML = util.promisify(require('xml2js').parseString)
const { URL } = require('url')
const process = require('process')
const { exit } = process
const StreamZip = require('node-stream-zip')
const execa = require('execa')
const getStream = require('get-stream')

async function asyncRetry3(f){
  let result_e
  for(let i=3;i>0;i--){
    try {
      return await f()
    } catch(e) {
      result_e = e
    }}
  throw result_e}

async function readAFileFromZipAsStream(path, inner_path){
  const zip = new StreamZip({file: path, storeEntries: true})
  return await new Promise((resolve, reject)=>{
    zip.on('ready', ()=>zip.stream(inner_path, (err, stm)=>err==null?resolve(stm):reject(err)))
    zip.on('error', e=>reject(e))})}
async function lsZip(path){
  const zip = new StreamZip({file: path, storeEntries: true})
  return await new Promise((resolve, reject)=>{
    zip.on('ready', ()=>resolve(Object.values(zip.entries())))
    zip.on('error', e=>reject(e))})}
const writeFile = util.promisify(fs.writeFile)
const readFile = util.promisify(fs.readFile)
const readDir = util.promisify(fs.readdir)
const stat = util.promisify(fs.stat)
const exists = util.promisify(fs.exists)
function shelljs2promise(f){
  return async function(...args){
    return await new Promise((resolve, reject)=>{
      const result = f(...args)
      return (result.code===0||result.code===void 0)?resolve(result):reject(result)})}}
const pushd = shelljs2promise(shell.pushd)
const popd = shelljs2promise(shell.popd)
const mv = shelljs2promise(shell.mv)
const cp = shelljs2promise(shell.cp)
const rm = shelljs2promise(shell.rm)
const mkdir = shelljs2promise(shell.mkdir)
const chmod = shelljs2promise(shell.chmod)
const sed = shelljs2promise(shell.sed)
const find = shelljs2promise(shell.find)
const touch = shelljs2promise(shell.touch)
const ls = shelljs2promise(shell.ls)

async function execaToStdIO(...args){
  const r = execa(...args)
  r.stdout.pipe(process.stdout)
  r.stderr.pipe(process.stderr)
  return await r}

async function assertIsZip(path){
  if(!(await isZip(path))){ throw `"${path}" is not zip!` }}
async function download(path, url){return await asyncRetry3(async ()=>{
  try {
    console.log(`Downloading ${url} to ${path} ...`)
    const result = await request({
      method: 'GET',
      encoding: null,
      url: url,
    })
    await writeFile(path, result, 'binary')
  } catch(e) {
    console.log(`Download failed: ${url}  error=${e}`)
    throw e}})}
/*
async function download(path, url){
  try {
    console.log(`Downloading ${url} to ${path} ...`)
    await execaToStdIO("curl", ["-Lo", path, url])
  } catch(e) {
    console.log(`Download failed: ${url}  error=${e}`)
    throw e}}
*/
async function downloadZip(path, url){
  await download(path, url)
  await assertIsZip(path)}

async function get_spigot_plugin_url(id){return await asyncRetry3(async ()=>{
  const base_url = `https://www.spigotmc.org/resources/${id}/`
  const document = new JSDOM(await get(base_url)).window.document
  const url = document.querySelector("label.downloadButton > a").href
  const url_head = `https://www.spigotmc.org/resources/${id}/download?version=`
  if(url.slice(0, url_head.length) !== url_head){ throw `SpigotMC API changed url=${url}` }
  //return `https://web.archive.org/save/${url}`
  return url})}
async function get_mediafire_url(id){return await asyncRetry3(async ()=>{
  const url = `https://www.mediafire.com/file/${id}/file`
  const document = new JSDOM(await get(url)).window.document
  return new URL(document.querySelector("#download_link > a.input").href, url).href})}
async function get_jekins_binary_url_all(url){return await asyncRetry3(async ()=>{
  const document = new JSDOM(await get(url)).window.document
  return Array.from(document.querySelectorAll(".dirTree > .fileList > tbody > tr > td > a")).map(x=>new URL(x.href, url).href).filter(x=>!(x.includes("/*fingerprint*/") || x.includes("/*view*/") || x.includes("javadoc") || x.includes("sources")))})}
async function get_jekins_binary_url_one(url){
  const list = await get_jekins_binary_url_all(url)
  if(list.length !== 1){throw 'get_jekins_binary_url_one: too many element'}
  return list[0]}
async function get_bukkitdev_url(name){return await asyncRetry3(async ()=>{// `https://web.archive.org/save` is used to bypass cloudflare
  const base_url = `https://web.archive.org/save/https://dev.bukkit.org/projects/${name}/files`
  //const base_url = `https://dev.bukkit.org/projects/${name}/files`
  const document = new JSDOM(await get(base_url)).window.document
  const url = document.querySelector(".project-file-name-container > a").href
  const url_head = `/save/https://dev.bukkit.org/projects/${name}/files/`
  //const url_head = `/projects/${name}/files/`
  if(url.slice(0, url_head.length) !== url_head){ throw `BukkitDev API changed url=${url}` }
  const id = url.slice(url_head.length)
  if(id.length !== 7){ throw `BukkitDev API changed id=${id}` }
  const head4 = id.slice(0, 4).replace(/^0+/, '')
  const tail3 = id.slice(4).replace(/^0+/, '')
  const document_file_page = new JSDOM(await get(new URL(url, base_url).href)).window.document
  const file_name_div = document_file_page.querySelector(".details-info > ul > li > .info-data") // maybe jsdom bug: innerText = undefined
  const file_name = (await parseXML(file_name_div.outerHTML)).div._
  return `https://media.forgecdn.net/files/${head4}/${tail3}/${file_name}`})}
async function get_github_release_url(id){return await asyncRetry3(async ()=>{
  const url = `https://github.com/${id}/releases/latest`
  const document = new JSDOM(await get(url)).window.document
  return new URL(document.querySelector(".Details-element > div > div > div > a").href, url).href})}
async function get_papermc_url(){return await asyncRetry3(async ()=>{
  const mc_version = JSON.parse(await get("https://papermc.io/api/v1/paper/")).versions[0]
  if(mc_version!=='1.15.2'){throw `manual review requested: papermc 1.15.2 -> ${mc_version}`}
  const build_version = JSON.parse(await get(`https://papermc.io/api/v1/paper/${mc_version}`)).builds.latest
  return `https://papermc.io/api/v1/paper/${mc_version}/${build_version}/download`})}
async function check_paperclip_version(path, version){
  return (await getStream(await readAFileFromZipAsStream(path, 'patch.properties'))).includes(`\nversion=${version}\n`)}
async function assert_paperclip_mc_1_15_2(){
  if(!await check_paperclip_version("dist/mc.jar", "1.15.2")){throw `manual review requested: minecraft upgrade`}}
async function get_papermc_paperclip(){
  await mkdir("-p", "dist")
  await downloadZip("dist/mc.jar", await get_papermc_url())}
async function get_tuinity_paperclip(){
  await mkdir("-p", "dist")
  await downloadZip("dist/mc.jar", "https://api.cirrus-ci.com/v1/artifact/github/The-Unstable-World/Tuinity-builds/build/binary/Tuinity/tuinity-paperclip.jar")}
async function get_mc_from_paperclip(){
  await rm("-fr", "tmp")
  await mkdir("-p", "tmp/plugins")
  await mv("dist/mc.jar", "tmp/")
  await downloadZip("tmp/plugins/StopSpigotWhenFullyLoaded.jar", "https://github.com/The-Unstable-World/StopSpigotWhenFullyLoaded/releases/download/1.0-SNAPSHOT-2/StopSpigotWhenFullyLoaded-1.0-SNAPSHOT.jar")
  await writeFile("tmp/eula.txt", "eula=true")
  // not generate the world
  await writeFile("tmp/paper.yml", `
world-settings:
  default:
    keep-spawn-loaded: false
`)
  await pushd("tmp")
  await execaToStdIO("java", ["-Xms256M", "-Xmx1G", "-jar", "mc.jar"])
  await popd()
  await mkdir("-p", "dist")
  await writeFile("dist/eula.txt", "eula=true")
  await mv("tmp/cache/patched_*.jar", "dist/mc.jar")
  await rm("-fr", "tmp")}
async function gen_configs(){
  await rm("-fr", "tmp")
  await cp("-fr", "dist", "tmp")
  await downloadZip("tmp/plugins/TMPStopSpigotWhenFullyLoaded.jar", "https://github.com/The-Unstable-World/StopSpigotWhenFullyLoaded/releases/download/1.0-SNAPSHOT-2/StopSpigotWhenFullyLoaded-1.0-SNAPSHOT.jar")
  await writeFile("tmp/server.properties", "online-mode=false")
  await mkdir("-p", "tmp/plugins/PluginMetrics")
  await writeFile("tmp/plugins/PluginMetrics/config.yml", "opt-out: true")
  await mkdir("-p", "tmp/plugins/bStats")
  await writeFile("tmp/plugins/bStats/config.yml", "enabled: false")
  await pushd("tmp")
  await execaToStdIO("java", ["-Xms256M", "-Xmx1G", "-jar", "mc.jar"])
  await popd()
  await rm("-fr", "tmp/plugins/TMPStopSpigotWhenFullyLoaded.jar", "tmp/plugins/TMPStopSpigotWhenFullyLoaded")
  for(const plugin of await readDir("tmp/plugins")){ if((await stat(`tmp/plugins/${plugin}`)).isDirectory()){
    await mkdir("-p", `dist/plugins/${plugin}`)
    for(const f of ["config.yml", "messages.yml", "lang"]){ if(await exists(`tmp/plugins/${plugin}/${f}`)){
      await rm("-fr", `dist/plugins/${plugin}/${f}`)
      await cp("-fr", `tmp/plugins/${plugin}/${f}`, `dist/plugins/${plugin}/`)}}}}
  await cp("tmp/server.properties", "tmp/*.yml", "dist/")
  for(const [dir, names] of [
    ["", ["bukkit.yml", "commands.yml", "help.yml", "paper.yml", "permissions.yml", "spigot.yml", "wepif.yml"]], // "tuinity.yml"
    ["plugins", ["AutoRestart", "DummyFawe.jar", "FastAsyncWorldEdit"]],
    ["plugins/GroupManager", ["globalgroups.yml"]],
    //["plugins/GroupManager/worlds", ["world"]], // refer to below
    ["plugins/ServerListPlus", ["ServerListPlus.yml"]],
    ["plugins/SkinsRestorer", ["command-messages.properties"]],
    ["plugins/UltimateShops", ["suggested_prices.yml", "language.yml"]],
    ["plugins/GriefPreventionData", ["bannedWords.txt", "_schemaVersion"]],
    ["plugins/Essentials", ["custom_items.yml", "kits.yml", "items.json", "worth.yml", "upgrades-done.yml"]],
    ["plugins/QualityArmory", ["ammo", "attachments", "misc", "newGuns", "default_ironsightstoggleitem.yml"]],
    ["plugins/QualityArmoryVehicles", ["vehicles", "FAQ.txt", "fuels.yml"]],
  ]){ for(const name of names){
    await mkdir("-p", `dist/${dir}`)
    await rm("-fr", `dist/${dir}/${name}`)
    await cp("-fr", `tmp/${dir}/${name}`, `dist/${dir}/`)}}
  // remove a malformed char
  await writeFile("dist/plugins/AdvancedLogin/config.yml", (await readFile("dist/plugins/AdvancedLogin/config.yml", "utf8")).replace(String.fromCodePoint(65533),''))
  for(const [plugin, config, content] of [
    ["FastLogin", "config.yml", [["autoRegister", "true"]]],
    ["SkinsRestorer", "config.yml", [["Updater.Enabled", "false"]]],
    ["ProtocolLib", "config.yml", [["global.metrics", "false"]]],
    ["LightAPI", "config.yml", [["updater.enable", "false"]]],
    ["ServerListPlus", "ServerListPlus.yml", [["Stats", "false"]]],
    ["SmoothSleep", "config.yml", [["enable-stats", "false"]]],
    ["QualityArmory", "config.yml", [["AUTO-UPDATE", "false"]]],
    ["PixelPrinter", "config.yml", [["auto-update", "false"]]],
    ["Vault", "config.yml", [["update-check", "false"]]],
    //["CoreProtect", "config.yml", [["check-updates", "false"]]],
    ["Lukkit", "config.yml", [["update-checker", "false"]]],
    ["GriefPreventionData", "config.yml",
      [["GriefPrevention.SmartBan", "false"], // not ban ip
      ["GriefPrevention.MaxPlayersPerIpAddress", "0"]]], // disable the feature
    ["AdvancedLogin", "config.yml",
      [["SaveIP", "false"], // Should the plugin save the plays IP for the auto-login feature
      ["PIN-Length", "6"],
      //["HideLocation", "true"], // currently not working
      ["SpectatorOnLogin", "true"],
      ["KickAfterSec.Seconds", "256"],
      ["KickAfterSec.KickMessage", "&cYou have not logged in after 256 sec!"]]],
    ["Essentials", "config.yml", [
      //["use-bukkit-permissions", "false"], // enable `player-commands` // GroupManager installed, so disabled
      ["newbies.kit", ""]]], // not working with AdvancedLogin
    ["Graves", "config.yml", [
      ["settings.graveMax", "0"], // unlimited
      ["settings.graveTeleport", "true"], // Can the player teleport to their grave from the Graves GUI.
      ["settings.graveTeleportCost", "0"],
      ["settings.graveTime", "0"]]], // lasts forever.
  ]){for(const [key, val] of content){
    console.log(`editing dist/plugins/${plugin}/${config} ...`)
    await execaToStdIO("yq", ["write", "--inplace", `dist/plugins/${plugin}/${config}`, key, val])}}
  await writeFile("dist/plugins/Negativity/bstats.yml", "enabled: false")
  await execaToStdIO("yq", ["delete", "--inplace", "dist/wepif.yml", "permissions.users.sk89q"])
  await mkdir("-p", "dist/plugins/Essentials")
  // default motd.txt, created when a player join the server.
  await writeFile("dist/plugins/Essentials/motd.txt",`&6Welcome, {PLAYER}&6!
&6Type &c/help&6 for a list of commands.
&6Type &c/list&6 to see who else is online.
&6Players online:&c {ONLINE} &6- World time:&c {WORLDTIME12}`)
  await mkdir("-p", "dist/plugins/PluginMetrics")
  await writeFile("dist/plugins/PluginMetrics/config.yml", "opt-out: true")
  await mkdir("-p", "dist/plugins/bStats")
  await writeFile("dist/plugins/bStats/config.yml", "enabled: false")
  /*
    We cannot turn off automatic updates in the configuration file of ProtocolLib.
    https://github.com/dmulloy2/ProtocolLib/blob/2f09dec1c559cd287e8e33348ab08c99ae73c26e/src/main/java/com/comphenix/protocol/ProtocolConfig.java#L109
    https://github.com/dmulloy2/ProtocolLib/blob/2f09dec1c559cd287e8e33348ab08c99ae73c26e/src/main/java/com/comphenix/protocol/ProtocolLib.java#L595
    it only update when `currentTime > updateTime && !updater.isChecking()`
    java.lang.Long: MAX_VALUE = 2^63-1
  */
  await mkdir("-p", "dist/plugins/ProtocolLib")
  await writeFile("dist/plugins/ProtocolLib/lastupdate", "1152921504606847000") // 2^60 // https://duckduckgo.com/?q=2%5E60&t=ffab&ia=calculator
  /*
  // https://www.mcbbs.net/forum.php?mod=viewthread&tid=459602&page=1#pid8395481
  await writeFile("dist/permissions.yml",
`skinsrestorer.command.gui:
  description: Allow use of /skins
  default: true
`)
  */
  await mkdir("-p", "dist/plugins/GroupManager/worlds/world")
  await writeFile("dist/plugins/GroupManager/worlds/world/users.yml",
`# "For a more advanced configuration example utilizing the advanced features of GroupManager, see http://pastebin.com/a8ZA0j5G"
users: {}`)
  await writeFile("dist/plugins/GroupManager/worlds/world/groups.yml",
`# Group inheritance
#
# Any inherited groups prefixed with a g: are global groups
# and are inherited from the GlobalGroups.yml.
#
# Groups without the g: prefix are groups local to this world
# and are defined in the this groups.yml file.
#
# Local group inheritances define your promotion tree when using 'manpromote/mandemote'

groups:
  Default:
    default: true
    permissions:
    - skinsrestorer.command.gui
    - essentials.afk
    - essentials.afk.auto
    - essentials.back
    - essentials.back.ondeath
    - essentials.balance
    - essentials.balance.others
    - essentials.balancetop
    - essentials.build
    - essentials.chat.color
    - essentials.chat.format
    - essentials.chat.shout
    - essentials.chat.question
    - essentials.clearinventory
    - essentials.compass
    - essentials.depth
    - essentials.delhome
    - essentials.getpos
    - essentials.geoip.show
    - essentials.help
    - essentials.helpop
    - essentials.home
    - essentials.home.others
    - essentials.ignore
    - essentials.info
    - essentials.itemdb
    - essentials.kit
    - essentials.kits.tools
    - essentials.list
    - essentials.mail
    - essentials.mail.send
    - essentials.me
    - essentials.motd
    - essentials.msg
    - essentials.msg.color
    - essentials.nick
    - essentials.near
    - essentials.pay
    - essentials.ping
    - essentials.protect
    - essentials.r
    - essentials.rules
    - essentials.realname
    - essentials.seen
    - essentials.sell
    - essentials.sethome
    - essentials.setxmpp
    - essentials.signs.create.protection
    - essentials.signs.create.trade
    - essentials.signs.break.protection
    - essentials.signs.break.trade
    - essentials.signs.use.balance
    - essentials.signs.use.buy
    - essentials.signs.use.disposal
    - essentials.signs.use.enchant
    - essentials.signs.use.free
    - essentials.signs.use.gamemode
    - essentials.signs.use.heal
    - essentials.signs.use.info
    - essentials.signs.use.kit
    - essentials.signs.use.mail
    - essentials.signs.use.protection
    - essentials.signs.use.repair
    - essentials.signs.use.sell
    - essentials.signs.use.time
    - essentials.signs.use.trade
    - essentials.signs.use.warp
    - essentials.signs.use.weather
    - essentials.spawn
    - essentials.suicide
    - essentials.time
    - essentials.tpa
    - essentials.tpaccept
    - essentials.tpahere
    - essentials.tpdeny
    - essentials.warp
    - essentials.warp.list
    - essentials.world
    - essentials.worth
    - essentials.xmpp
    info:
      prefix: '&e'
      build: true
      suffix: ''
  Admin:
    default: false
    permissions:
    - '*'
    inheritance:
    - default
    info:
      prefix: '&4'
      build: true
      suffix: ''`)
  await rm("-fr", "tmp")}
async function minify_plugins(){ for(const jar of (await ls("dist/plugins/*.jar")).concat(["dist/mc.jar"])){
  const to_remove = (await lsZip(jar)).filter(x=>x.isFile).map(x=>x.name).filter(x=>x.endsWith(".java")||x.endsWith(".dll")||x.endsWith(".dylib")||x==='changelog.txt'||x==='LICENSE'||x==='License.txt'||x.startsWith('licenses/'))
  if(to_remove.length !== 0){
    console.log(`${jar}: removing ${to_remove.join(" ")} ...`)
    await execaToStdIO("7z", ["d", jar].concat(to_remove))}}}
async function readPluginYml(path, x){
  const {stdout} = await execa("yq", ["read", "-", x], {input: await readAFileFromZipAsStream(path, "plugin.yml")})
  return stdout}
async function get_plugins(plugins_to_get){
  await mkdir("-p", "dist/plugins")
  await Promise.all(plugins_to_get.map(async ([file, url, required_version]) => {
    const path = `dist/plugins/${file}.jar`
    const url_awaited = await ((async ()=>{try{return await url}catch(e){console.error(`URL failed (${file})`);throw e}})())
    await downloadZip(path, url_awaited)
    const current_version = await readPluginYml(path, "version")
    if(!(current_version===required_version || current_version.slice(0, required_version.length+1)===required_version+'.' || current_version.slice(0, required_version.length+1)===required_version+'-')){
      throw `manual review requested: ${file} ${required_version} -> ${current_version}`}}))}
async function apply_performance_patch(){
  // https://www.spigotmc.org/threads/guide-server-optimization%E2%9A%A1.283181/
  await sed('-i', /^view-distance=.*$/, 'view-distance=5', 'dist/server.properties')
  for(const [file, content] of [
    ["bukkit.yml", [
      ["chunk-gc.period-in-ticks", "400"],
      ["ticks-per.monster-spawns", "4"],
      ["spawn-limits.monsters", "50"],
      ["spawn-limits.animals", "8"],
      ["spawn-limits.water-animals", "3"],
      ["spawn-limits.ambient", "1"]]],
    ["spigot.yml", [
      ["world-settings.default.entity-activation-range.animals", "16"],
      ["world-settings.default.entity-activation-range.monsters", "24"],
      ["world-settings.default.entity-activation-range.raiders", "32"],
      ["world-settings.default.entity-activation-range.misc", "8"],
      ["world-settings.default.entity-activation-range.water", "8"],
      ["world-settings.default.entity-activation-range.tick-inactive-villagers", "false"],
      ["world-settings.default.merge-radius.exp", "6.0"],
      ["world-settings.default.merge-radius.item", "4.0"],
      ["world-settings.default.mob-spawn-range", "4"]]],
    ["paper.yml", [
      ["world-settings.default.remove-corrupt-tile-entities", "true"],
      ["world-settings.default.optimize-explosions", "true"],
      ["world-settings.default.mob-spawner-tick-rate", "4"],
      ["world-settings.default.container-update-tick-rate", "3"],
      ["world-settings.default.grass-spread-tick-rate", "4"],
      ["world-settings.default.hopper.disable-move-event", "true"],
      ["world-settings.default.prevent-moving-into-unloaded-chunks", "true"],
      ["world-settings.default.use-faster-eigencraft-redstone", "true"],
      ["world-settings.default.keep-spawn-loaded", "false"]]],
  ]){ for(const [key, val] of content){
    console.log(`editing dist/${file} ...`)
    await execaToStdIO("yq", ["write", "--inplace", `dist/${file}`, key, val])}}}
/*async function get_worldedit_url(){
  const url = "https://builds.enginehub.org/job/worldedit/last-successful?branch=master"
  const document = new JSDOM(await get(url)).window.document
  const results = Array.from(document.querySelectorAll("a")).map(x=>x.href).filter(x=>x.includes("-bukkit-"))
  if(results.length !== 1){ throw 'WorldEdit Download Page Changed' }
  return new URL(results[0], url).href}*/
async function get_base_plugins(){
  const EssentialsXCI = "https://ci.ender.zone"
  //const EssentialsXCI = "https://old.ci.akpmakes.tech"
  await get_plugins([
    ["Vault", get_spigot_plugin_url("vault.34315"), "1.7"],
    ["LightAPI", get_spigot_plugin_url("lightapi-fork.48247"), "3.4"],
    //["ProtocolLib", get_github_release_url("dmulloy2/ProtocolLib"), "4.5"], // https://ci.dmulloy2.net/job/ProtocolLib/lastSuccessfulBuild/ `RequestError: Error: unable to verify the first certificate`
    ["ProtocolLib", get_github_release_url("The-Unstable-World/ProtocolLib-No-ASM"), "4.5"],

    ["Lukkit", get_github_release_url("Lukkit/Lukkit"), "2"],

    ["ServerListPlus", (async ()=>list_assert_one((await get_jekins_binary_url_all("https://ci.codemc.io/job/Minecrell/job/ServerListPlus/lastSuccessfulBuild/artifact/Bukkit/build/libs/")).filter(x=>x.includes("-Bukkit.jar"))))(), "3.5"],
    ["ClientStats", get_spigot_plugin_url("clientstats-bukkit-spigot.24329"), "2.10"],
    ["SkinsRestorer", get_github_release_url("SkinsRestorer/SkinsRestorerX"), "13.7"],
    ["UltimateShops", get_spigot_plugin_url("ultimateshops-player-admin-item-shops-1-8-1-15-x-lite.61048"), "2.0"],
    ["Graves", get_spigot_plugin_url("graves.74208"), "3"],
    ["SmoothSleep", get_spigot_plugin_url("smoothsleep.32043"), "2.8"],

    //1.15 not supported//["PacketListenerAPI", get_github_release_url("InventivetalentDev/PacketListenerAPI"), "3.7"], // a dependence of AnimatedFrames
    //1.15 not supported//["MapManager", get_github_release_url("InventivetalentDev/MapManager"), "1.7"], // a dependence of AnimatedFrames
    //1.15 not supported//["AnimatedFrames", get_github_release_url("InventivetalentDev/AnimatedFrames"), "4.11"],
    //1.15 not supported//["WebFrames", get_github_release_url("InventivetalentDev/WebFrames"), "2.2"],

    //["WorldEdit", get_worldedit_url(), "7.1"],
    ["FastAsyncWorldEdit", get_jekins_binary_url_one("https://ci.athion.net/job/FastAsyncWorldEdit-1.15/lastSuccessfulBuild/artifact/worldedit-bukkit/build/libs/"), "1.15"], // url depends on minecraft version
    ["FastAsyncVoxelSniper", get_jekins_binary_url_one("https://ci.athion.net/job/FastAsyncVoxelSniper-flattening/lastSuccessfulBuild/artifact/build/libs/"), "1.0"],

    //["CoreProtect", get_spigot_plugin_url("coreprotect.8631"), "2.18"],
    ["GroupManager", get_github_release_url("GroupManager/GroupManager"), "0.3"],
    ["Negativity", get_spigot_plugin_url("ac-negativity-spigot-1-7-1-15-sponge-bungeecord-velocity.48399"), "1.5"],
    //["GriefPrevention", get_bukkitdev_url("grief-prevention"), "16.13"], // URL currently not working
    ["GriefPrevention", "https://media.forgecdn.net/files/2874/7/GriefPrevention.jar", "16.13"],
    ["AutoRestart", "https://gitlab.com/dennislysenko/autorestart-v4/uploads/92b2640801cc1d61c7ee409763af2506/AutoRestart-v4.jar", "4"], // https://gitlab.com/dennislysenko/autorestart-v4/-/releases

    ["EssentialsX", get_jekins_binary_url_one(`${EssentialsXCI}/job/EssentialsX/lastSuccessfulBuild/artifact/Essentials/target/`), "2.17"],
    //["EssentialsAntiBuild", get_jekins_binary_url_one(`${EssentialsXCI}/job/EssentialsX/lastSuccessfulBuild/artifact/EssentialsAntiBuild/target/`), "2.17"],
    ["EssentialsXChat", get_jekins_binary_url_one(`${EssentialsXCI}/job/EssentialsX/lastSuccessfulBuild/artifact/EssentialsChat/target/`), "2.17"],
    //["EssentialsXGeoIP", get_jekins_binary_url_one(`${EssentialsXCI}/job/EssentialsX/lastSuccessfulBuild/artifact/EssentialsGeoIP/target/`), "2.17"],
    //["EssentialsXProtect", get_jekins_binary_url_one(`${EssentialsXCI}/job/EssentialsX/lastSuccessfulBuild/artifact/EssentialsProtect/target/`), "2.17"],
    ["EssentialsXSpawn", get_jekins_binary_url_one(`${EssentialsXCI}/job/EssentialsX/lastSuccessfulBuild/artifact/EssentialsSpawn/target/`), "2.17"],
    //["EssentialsXXMPP", get_jekins_binary_url_one(`${EssentialsXCI}/job/EssentialsX/lastSuccessfulBuild/artifact/EssentialsXMPP/target/`), "2.17"],

    ["PluginConstructorAPI", get_github_release_url("ZombieStriker/PluginConstructorAPI"), "1.0"], // a dependence of ZombieStriker's plugins
    ["PixelPrinter", get_spigot_plugin_url("pixelprinter.29760"), "1.0"],
    ["QualityArmory", get_spigot_plugin_url("quality-armory.47561"), "1.1"],
    ["QualityArmoryVehicles", get_mediafire_url("1ap048p3i424e6q/QualityArmoryVehicles_1.0.64.jar"), "1.0"], // https://www.spigotmc.org/resources/qualityarmory-vehicles.59129/
  ])}
async function get_Krakatau(){
  await execaToStdIO("curl", ["-Lo", "Krakatau.zip", "https://github.com/Storyyeller/Krakatau/archive/e4d3fa12f8ef8a1da25c07fca0e22ed18eb410b2.zip"])
  await execaToStdIO("7z", ["x", "Krakatau.zip"])
  await mv("Krakatau-e4d3fa12f8ef8a1da25c07fca0e22ed18eb410b2", "Krakatau")
  await rm("Krakatau.zip")}
async function patch_plugins(){
  await rm("-fr", "tmp")
  await mkdir("tmp")
  await pushd("tmp")
  await get_Krakatau()
  await execaToStdIO("7z", ["x", "../dist/plugins/UltimateShops.jar", "thirtyvirus/ultimateshops/UltimateShops.class"])
  await execaToStdIO("7z", ["d", "../dist/plugins/UltimateShops.jar", "thirtyvirus/ultimateshops/UltimateShops.class"])
  await execaToStdIO("python3", ["Krakatau/disassemble.py", "thirtyvirus/ultimateshops/UltimateShops.class"])
  await rm("thirtyvirus/ultimateshops/UltimateShops.class")
  const lines = (await readFile("thirtyvirus/ultimateshops/UltimateShops.j", "utf8")).split("\n")
  let found = false
  for(let i=0;i<lines.length;i++){
    if(lines[i].includes('putfield Field thirtyvirus/ultimateshops/UltimateShops premium Z') && i!==0){
      if(found){
        throw 'patch_plugins: too many "putfield ... premium ..."'
      } else {
        found = true
        const new_line = lines[i-1].replace('iconst_0', 'iconst_1')
        if(lines[i-1] == new_line){ throw 'patch_plugins: replace failed' }
        lines[i-1] = new_line
      }
    }
  }
  if(!found){ throw 'patch_plugins: no "putfield ... premium ..."' }
  await writeFile("thirtyvirus/ultimateshops/UltimateShops.j", lines.join("\n"))
  await execaToStdIO("python3", ["Krakatau/assemble.py", "thirtyvirus/ultimateshops/UltimateShops.j"])
  await execaToStdIO("7z", ["a", "../dist/plugins/UltimateShops.jar", "thirtyvirus/ultimateshops/UltimateShops.class"])
  await popd()
  await rm("-fr", "tmp")}
async function patch_for_openj9(){
  // (OpenJ9 issue)
    //[10:38:22 ERROR]: Error occurred while enabling AutoRestart v3.3.3 (Is it up to date?)
    //java.lang.ExceptionInInitializerError: null
    //  at java.lang.J9VMInternals.ensureError(Unknown Source) ~[?:?]
    //  ...
    //Caused by: java.lang.IllegalArgumentException: The embedded resource 'Config.yml' cannot be found in plugins/AutoRestart.jar
  //
  await rm("-fr", "tmp")
  await mkdir("tmp")
  await pushd("tmp")
  await touch("Config.yml")
  await execaToStdIO("7z", ["a", "../dist/plugins/AutoRestart.jar", "Config.yml"])
  await popd()
  await rm("-fr", "tmp")
  await mkdir("-p", "dist/plugins/AutoRestart")
  await touch("dist/plugins/AutoRestart/Config.yml")}
/*
async function get_compatibility_plugins(){
  await get_plugins([
    ["ViaVersion", get_jekins_binary_url_one("https://ci.viaversion.com/job/ViaVersion-Abstraction/lastSuccessfulBuild/artifact/jar/target/"), "3.0"],
    ["ViaBackwards", get_jekins_binary_url_one("https://ci.viaversion.com/view/ViaBackwards/job/ViaBackwards-Abstraction/lastSuccessfulBuild/artifact/all/target/"), "3.0"],
    ["ViaRewind", get_jekins_binary_url_one("https://ci.viaversion.com/view/ViaRewind/job/ViaRewind-DEV/lastSuccessfulBuild/artifact/all/target/"), "1.5"],
    ["ProtocolSupportPotions", get_spigot_plugin_url("protocolsupportpotions.52537"), "3.3"],
    ["ViaRewind-Legacy-Support", get_jekins_binary_url_one("https://ci.viaversion.com/view/ViaRewind/job/ViaRewind%20Legacy%20Support/lastSuccessfulBuild/artifact/target/"), "1.3"]])}
*/
async function get_compatibility_plugins(){
  await get_plugins([
    ["ProtocolSupport", "https://build.true-games.org/job/ProtocolSupport/lastSuccessfulBuild/artifact/target/ProtocolSupport.jar", "4"],
    ["ProtocolSupportLegacyChest", get_spigot_plugin_url("protocolsupportlegacychest.59314"), "1.3"],
    ["ProtocolSupportPotions", get_spigot_plugin_url("protocolsupportpotions.52537"), "3.3"]])}
async function get_auth_plugins(){
  await get_plugins([
    ["AdvancedLogin", get_mediafire_url("jhowlyv040la7x5/AdvancedLogin_3.10.jar"), "3.10"], // https://www.spigotmc.org/resources/advancedlogin.10510/
    ["FastLogin", get_jekins_binary_url_one("https://ci.codemc.io/job/Games647/job/FastLogin/lastSuccessfulBuild/artifact/bukkit/target/"), "1.11"], // https://www.spigotmc.org/resources/fastlogin.14153/
  ])}
function package_async_program(f){return async () => {
  try{
    await f()
    exit(0)
  }catch(e){
    console.error(e)
    exit(1)}}}
async function get_files_list(path){
  await pushd(path)
  const result = []
  for(const f of await find(".")){
    if((await stat(f)).isFile()){
      result.push(f)}}
  await popd()
  return result}
async function make_files_list(){
  await touch("dist/files.list") // include `files.list` itself.
  await writeFile("dist/files.list", (await get_files_list("dist")).join(" "))}
async function main(){
  await get_papermc_paperclip()
  //await get_tuinity_paperclip()
  await assert_paperclip_mc_1_15_2()
  await get_mc_from_paperclip()
  await Promise.all([
    get_base_plugins(),
    get_auth_plugins(),
    get_compatibility_plugins()])
  await patch_plugins()
  await gen_configs()
  await apply_performance_patch()
  await minify_plugins()
  await make_files_list()}
exports.main = package_async_program(main)
exports.make_files_list = package_async_program(make_files_list)
exports.patch_for_openj9 = package_async_program(patch_for_openj9)
