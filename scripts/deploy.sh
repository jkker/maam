docker build -t maam .
mkdir -p dist
docker save -o dist/maam.tar maam
scp dist/maam.tar jerry@10.0.0.36: