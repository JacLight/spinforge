#!/usr/bin/expect -f

set timeout 30
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@192.168.88.2

expect "password:"
send "UYU9xmN_dSyu\r"

expect "root@"
send "pfctl -sr | grep -E '80|443|rdr'\r"
expect "root@"
send "pfctl -sn | grep -E '80|443'\r"
expect "root@"
send "exit\r"

expect eof