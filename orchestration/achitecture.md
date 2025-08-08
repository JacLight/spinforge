
SpinForge-01
SpinForge-02
SpinForge-03

SpinForge-Items
--haproxy
--keydb
--ngnix/openresty


Shared
-- File Mount for all data store 
    /mnt/hosting

-- keydb on all hosts -- clustered into one

-- haproxy primary entry point 

-- keepalived + Vip



Flow

Request -> Active VIP node -> Active HAProxy -> forward to node base on defined lb rule