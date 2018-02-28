# Getting started
npm install serverless-offline --save-dev
sls offline start  --stage=local
curl -X POST localhost:3000/acs/user/<username>/sync
