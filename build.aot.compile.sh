#!/bin/sh
set -e
cd "$(dirname "$0")"
rm -fr aot.tmp
mkdir aot.tmp
cd aot.tmp
unzip ../dist/mc.jar
# full: 802 MB, too large.
# for 1.15.2
#FILES_TO_BUILD="net org/bukkit org/fusesource org/gjt org/jline org/json org/slf4j org/spigotmc org/sqlite org/yaml com/destroystokyo com/google com/lmax com/mojang co it javax joptsimple io/netty/bootstrap io/netty/buffer io/netty/resolver"
# To reduce startup time
FILES_TO_BUILD="$(echo net/minecraft/server/*/WorldGen*.class org/bukkit org/spigotmc com/destroystokyo)"
jaotc --output=../dist/mc.partial.so --verbose -J-cp -J. $(find $FILES_TO_BUILD -name '*.class') -J-Xmx7000M -J-Xms4096M -J-Xss1024M
cd ..
rm -fr aot.tmp
