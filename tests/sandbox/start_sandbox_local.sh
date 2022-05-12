#!/bin/bash

SANDBOX_STATE=~/tmp/near-sandbox

# cleanup on exit:
trap "rm -rf /tmp/near-sandbox" EXIT KILL


target/debug/neard-sandbox --home $SANDBOX_STATE init
target/debug/neard-sandbox --home $SANDBOX_STATE run  # doesn't return ...

