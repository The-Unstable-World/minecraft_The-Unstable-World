#!/bin/sh
set -e
cd "$(dirname "$0")"
rm -fr tmp dist/OpenJ9Cache
cp -fr dist tmp
cd tmp
mkdir -p plugins/TMPStopAfterServerLoadEvent.lkt
cat << 'EOF' > plugins/TMPStopAfterServerLoadEvent.lkt/plugin.yml
main: main.lua
version: 1.0
name: TMPStopAfterServerLoadEvent
description: TMPStopAfterServerLoadEvent
author: Author
EOF
cat << 'EOF' > plugins/TMPStopAfterServerLoadEvent.lkt/main.lua
plugin.registerEvent("ServerLoadEvent", function(...)
  local s = plugin.getServer()
  s:shutdown()
end)
EOF
REPEAT3(){
  "$@" && "$@" && "$@"
}
REPEAT3 java -Xshareclasses:name=mc,cacheDir="$PWD/OpenJ9Cache",cacheDirPerm=700 -Xscmx64M -jar mc.jar
cd ..
mv tmp/OpenJ9Cache dist/
rm -fr tmp
