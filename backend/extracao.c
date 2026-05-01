#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <dirent.h>

//////////////// CPU //////////////////
void read_cpu(long *idle, long *total) {
    FILE *fp = fopen("/proc/stat", "r");
    long user, nice, system, iowait, irq, softirq;

    fscanf(fp, "cpu %ld %ld %ld %ld %ld %ld %ld",
           &user, &nice, &system, idle, &iowait, &irq, &softirq);

    *idle += iowait;
    *total = user + nice + system + *idle + irq + softirq;

    fclose(fp);
}

float cpu_usage(long prev_idle, long prev_total, long curr_idle, long curr_total) {
    long total_diff = curr_total - prev_total;
    long idle_diff = curr_idle - prev_idle;

    if (total_diff == 0) return 0;
    return 100.0 * (total_diff - idle_diff) / total_diff;
}

//////////////// MEMORY //////////////////
void memory(long *total, long *available) {
    FILE *fp = fopen("/proc/meminfo", "r");
    char line[128];

    while (fgets(line, sizeof(line), fp)) {
        sscanf(line, "MemTotal: %ld kB", total);
        sscanf(line, "MemAvailable: %ld kB", available);
    }

    fclose(fp);
}

//////////////// DISK //////////////////
void disk(char *out) {
    FILE *fp = popen("df -h / | tail -1", "r");
    fgets(out, 256, fp);
    pclose(fp);
}

//////////////// NETWORK //////////////////
void network(long *rx, long *tx) {
    FILE *fp = fopen("/proc/net/dev", "r");
    char line[256];

    fgets(line, sizeof(line), fp);
    fgets(line, sizeof(line), fp);

    while (fgets(line, sizeof(line), fp)) {
        char iface[50];

        sscanf(line, "%[^:]: %ld %*s %*s %*s %*s %*s %*s %*s %ld",
               iface, rx, tx);

        if (strcmp(iface, "lo") != 0) break;
    }

    fclose(fp);
}

//////////////// TEMPERATURE //////////////////
float temperature() {
    DIR *dir = opendir("/sys/class/thermal");
    struct dirent *entry;
    float max = -1;

    while ((entry = readdir(dir))) {
        if (strncmp(entry->d_name, "thermal_zone", 12) == 0) {
            char path[256];
            sprintf(path, "/sys/class/thermal/%s/temp", entry->d_name);

            FILE *fp = fopen(path, "r");
            int t;

            if (fp && fscanf(fp, "%d", &t) == 1) {
                float c = t / 1000.0;
                if (c > max) max = c;
                fclose(fp);
            }
        }
    }

    closedir(dir);
    return max;
}

//////////////// MAIN //////////////////
int main() {
    long prev_idle = 0, prev_total = 0;
    long prev_rx = 0, prev_tx = 0;

    read_cpu(&prev_idle, &prev_total);
    network(&prev_rx, &prev_tx);

    while (1) {
        sleep(5);

        long curr_idle, curr_total;
        read_cpu(&curr_idle, &curr_total);

        long total_mem, avail_mem;
        memory(&total_mem, &avail_mem);

        char disk_info[256];
        disk(disk_info);

        long rx, tx;
        network(&rx, &tx);

        float temp = temperature();

        system("clear");

        printf("{\n");
        printf("  \"cpu\": %.2f,\n", cpu_usage(prev_idle, prev_total, curr_idle, curr_total));
        printf("  \"memory\": {\"total\": %ld, \"used\": %ld, \"available\": %ld},\n",
               total_mem, total_mem - avail_mem, avail_mem);
        printf("  \"disk\": \"%s\",\n", disk_info);
        printf("  \"temperature\": %.2f,\n", temp);
        printf("  \"network\": {\"rx\": %ld, \"tx\": %ld, \"rx_rate\": %ld, \"tx_rate\": %ld}\n",
               rx, tx, rx - prev_rx, tx - prev_tx);
        printf("}\n");

        prev_idle = curr_idle;
        prev_total = curr_total;
        prev_rx = rx;
        prev_tx = tx;
    }

    return 0;
}