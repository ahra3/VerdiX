import random
import time
from datetime import datetime, timedelta

def generate_normal_blocks(logs, current_time, count):
    for i in range(count):
        block_id = f"blk_{random.randint(1000000000000000000, 9999999999999999999)}"
        ip = f"10.250.{random.randint(1,255)}.{random.randint(1,255)}"
        
        logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 143 INFO dfs.DataNode$DataXceiver: Receiving block {block_id} src: /{ip}:54106 dest: /{ip}:50010")
        current_time += timedelta(seconds=1)
        logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 35 INFO dfs.FSNamesystem: BLOCK* NameSystem.allocateBlock: /mnt/hadoop/mapred/system/job/job.jar. {block_id}")
        current_time += timedelta(seconds=1)
        logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 143 INFO dfs.DataNode$PacketResponder: PacketResponder 1 for block {block_id} terminating")
        current_time += timedelta(seconds=1)
        size = random.randint(1000000, 67108864)
        logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 143 INFO dfs.DataNode$PacketResponder: Received block {block_id} of size {size} from /{ip}")
        current_time += timedelta(seconds=1)
        logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 35 INFO dfs.FSNamesystem: BLOCK* NameSystem.addStoredBlock: blockMap updated: {ip}:50010 is added to {block_id} size {size}")
        current_time += timedelta(seconds=random.randint(1, 3))
    return current_time

def inject_write_path_failure(logs, current_time):
    block_id = f"blk_-{random.randint(1000000000000000000, 9999999999999999999)}"
    ip3 = "10.250.19.102"
    ip4 = "10.250.10.6"
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 143 INFO dfs.DataNode$DataXceiver: Receiving block {block_id} src: /{ip3}:54106 dest: /{ip3}:50010")
    current_time += timedelta(seconds=1)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 35 INFO dfs.FSNamesystem: BLOCK* NameSystem.allocateBlock: /mnt/hadoop/mapred/system/job_error/job.jar. {block_id}")
    current_time += timedelta(seconds=1)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 145 WARN dfs.DataNode$DataXceiver: {ip3}:50010:Exception writing block {block_id} to mirror {ip4}:50010")
    current_time += timedelta(seconds=2)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 145 ERROR dfs.DataNode$DataXceiver: Exception in receiveBlock for block {block_id}")
    return current_time + timedelta(seconds=3)

def inject_serve_failure(logs, current_time):
    block_id = f"blk_{random.randint(1000000000000000000, 9999999999999999999)}"
    ip = "10.250.14.22"
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 145 INFO dfs.DataNode$DataXceiver: Served block {block_id} to /{ip}")
    current_time += timedelta(seconds=1)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 147 ERROR dfs.DataNode$DataXceiver: {ip}:50010:Exception reading block {block_id}: java.io.IOException: Connection reset by peer")
    current_time += timedelta(seconds=1)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 148 ERROR dfs.DataNode$DataXceiver: Failed to read block {block_id} from /{ip}")
    return current_time + timedelta(seconds=3)

def inject_metadata_inconsistency(logs, current_time):
    block_id = f"blk_{random.randint(1000000000000000000, 9999999999999999999)}"
    ip = "10.250.11.88"
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 45 INFO dfs.FSNamesystem: BLOCK* NameSystem.addStoredBlock: blockMap updated: {ip}:50010 is added to {block_id} size 32450")
    current_time += timedelta(seconds=2)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 46 ERROR dfs.FSNamesystem: Exception in addStoredBlock. Block {block_id} does not belong to any file.")
    current_time += timedelta(seconds=1)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 47 ERROR dfs.FSNamesystem: Failed to update metadata for block {block_id}. Deleting orphan block.")
    return current_time + timedelta(seconds=3)

def inject_block_corruption(logs, current_time):
    block_id = f"blk_{random.randint(1000000000000000000, 9999999999999999999)}"
    ip = "10.250.9.14"
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 120 INFO dfs.DataBlockScanner: Verification succeeded for {block_id}")
    current_time += timedelta(seconds=10)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 121 ERROR dfs.DataBlockScanner: Verification Failed for {block_id}")
    current_time += timedelta(seconds=1)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 121 WARN dfs.FSNamesystem: BLOCK* NameSystem.markBlockAsCorrupt: {block_id} from {ip}:50010 is marked as corrupt")
    return current_time + timedelta(seconds=3)

def inject_replication_failure(logs, current_time):
    block_id = f"blk_{random.randint(1000000000000000000, 9999999999999999999)}"
    ip = "10.250.17.44"
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 75 INFO dfs.FSNamesystem: BLOCK* ask {ip}:50010 to replicate {block_id} to datanode(s)")
    current_time += timedelta(seconds=2)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 76 WARN dfs.DataNode$DataTransfer: Failed to transfer {block_id} to {ip}:50010 got java.net.ConnectException: Connection refused")
    current_time += timedelta(seconds=1)
    logs.append(f"{current_time.strftime('%y%m%d %H%M%S')} 77 ERROR dfs.FSNamesystem: Exception in replicateBlock. Failed replication for {block_id}")
    return current_time + timedelta(seconds=3)

def generate_logs():
    logs = []
    current_time = datetime(2008, 11, 9, 20, 35, 18)
    
    # Sequence 1
    current_time = generate_normal_blocks(logs, current_time, 50)
    current_time = inject_write_path_failure(logs, current_time)
    
    # Sequence 2
    current_time = generate_normal_blocks(logs, current_time, 50)
    current_time = inject_serve_failure(logs, current_time)
    
    # Sequence 3
    current_time = generate_normal_blocks(logs, current_time, 50)
    current_time = inject_metadata_inconsistency(logs, current_time)
    
    # Sequence 4
    current_time = generate_normal_blocks(logs, current_time, 50)
    current_time = inject_block_corruption(logs, current_time)
    
    # Sequence 5
    current_time = generate_normal_blocks(logs, current_time, 50)
    current_time = inject_replication_failure(logs, current_time)
    
    # Final normal sequence
    current_time = generate_normal_blocks(logs, current_time, 50)

    return "\n".join(logs)

if __name__ == "__main__":
    print("Generating large procedural HDFS_demo.log with multiple failure modes...")
    demo_logs = generate_logs()
    
    with open("HDFS_demo.log", "w") as f:
        f.write(demo_logs)
        
    print(f"HDFS_demo.log created successfully! ({len(demo_logs.splitlines())} lines generated)")
