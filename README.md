# The-Unstable-World (minecraft)

## server

### build

For some reason, I don't provide the binary.

Build Dependencies: patch, p7zip, curl, Python3, JDK 11 or 13, Node.JS, NPM and [yq 3.2.1](https://github.com/mikefarah/yq).

Before building, please check the building script to know which licenses it will break etc .

`./build.sh` to build the binary. `build.sh` returns a non-zero exit code when it fails. Building it implies you agree with some licenses. You cannot publish the binary because it will violate the GPL and some other licenses.

#### OpenJ9 patch

run `./patch_for_openj9.sh`

#### AOT compile PaperMC (partial)

run `./build.aot.compile.sh` and use following command to start papermc:
```
java -XX:+UnlockExperimentalVMOptions -XX:AOTLibrary=./mc.partial.so -jar mc.jar
```

#### build OpenJ9 cache (Class data sharing)

run `./build.openj9.cache.sh` and use following command to start papermc:
```
java -Xshareclasses:name=mc,cacheDir="$PWD/OpenJ9Cache",cacheDirPerm=700 -Xscmx64M -jar mc.jar
```

### running

You need to write two scripts, one to build and one to start the server.

The building script need to be atomic. It cannot provide corrupted binaries to scripts that start the server.

### start.sh

Must be named `start.sh` for PaperMC and AutoRestart to use this script

```
#!/bin/sh

set -e

cp -fr $BUILDING_REPO_PATH/dist/* ./ # Load the binary

# ... # use yq (https://github.com/mikefarah/yq) or heredoc to adjust the configuration files

java -jar mc.jar

rm -f $(cat files.list)
```

#### HotSpot flags

```
java -Xms4G -Xmx4G -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+UseG1GC -XX:MaxGCPauseMillis=45 -XX:TargetSurvivorRatio=90 -XX:G1NewSizePercent=50 -XX:G1MaxNewSizePercent=80 -XX:InitiatingHeapOccupancyPercent=10 -XX:G1MixedGCLiveThresholdPercent=50 -XX:+AlwaysPreTouch -XX:+ParallelRefProcEnabled -jar mc.jar
```

#### OpenJ9 flags

https://steinborn.me/posts/tuning-minecraft-openj9/

