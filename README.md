# DEPRECATED - This project is deprecated and no longer maintained

# acs-user-sync
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/b023bc9563e1426fb457e9e4eaf2ce45)](https://app.codacy.com/app/uw-it-edm/acs-user-sync?utm_source=github.com&utm_medium=referral&utm_content=uw-it-edm/acs-user-sync&utm_campaign=Badge_Grade_Dashboard)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=uw-it-edm/acs-user-sync)](https://dependabot.com)

develop [![Build Status](https://travis-ci.org/uw-it-edm/acs-user-sync.svg?branch=develop)](https://travis-ci.org/uw-it-edm/acs-user-sync) [![Coverage Status](https://coveralls.io/repos/github/uw-it-edm/acs-user-sync/badge.svg?branch=develop)](https://coveralls.io/github/uw-it-edm/acs-user-sync?branch=develop)

## Getting started
 Add a resources-local.yml to the config directory.


```
yarn install

serverless invoke local --function sync-user --stage=local --data '{"headers":{"example-username-key":"test-user"}}'  
```
## Test
yarn test
