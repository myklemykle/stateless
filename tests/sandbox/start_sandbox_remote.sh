#!/bin/sh

REMOTE_SANDBOX_SSH="osboxes@nearnode"
REMOTE_SANDBOX_CMD="cd stateless/nearcore; ./start_sandbox_local.sh"

ssh $REMOTE_SANDBOX_SSH $REMOTE_SANDBOX_CMD    # sandbox will continue to run until halted manually ...

# Now, in another shell, copy the master key from the remote to the local:
# scp osboxes@nearnode:tmp/near-sandbox/validator_key.json ~/tmp/near-sandbox
