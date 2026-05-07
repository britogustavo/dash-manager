#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <dirent.h>
#include <string.h>

//////////////// CPU //////////////////
void read_cpu(long *idle, long *total) {
    FILE *fp = fopen("/proc/stat", "r");

    if (fp == NULL) {
        return;
    }

    long user, nice, system, iowait, irq, softirq;

    fscanf(fp, "cpu %ld %ld %ld %ld %ld %ld %ld",
           &user, &nice, &system, idle, &iowait, &irq, &softirq);

    *idle += iowait;
    *total = user + nice + system + *idle + irq + softirq;

    fclose(fp);
}

float cpu_usage(long prev_idle, long prev_total,
                long curr_idle, long curr_total) {

    long total_diff = curr_total - prev_total;
    long idle_diff = curr_idle - prev_idle;

    if (total_diff == 0)
        return 0;

    return 100.0 * (total_diff - idle_diff) / total_diff;
}

//////////////// MEMORY //////////////////
void memory(long *total, long *available) {
    FILE *fp = fopen("/proc/meminfo", "r");

    if (fp == NULL) {
        return;
    }

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

    if (fp == NULL) {
        return;
    }

    fgets(out, 256, fp);

    // remove quebra de linha
    out[strcspn(out, "\n")] = 0;

    pclose(fp);
}

//////////////// NETWORK //////////////////
void network(long *rx, long *tx) {
    FILE *fp = fopen("/proc/net/dev", "r");

    if (fp == NULL) {
        return;
    }

    char line[256];

    // pula cabeçalhos
    fgets(line, sizeof(line), fp);
    fgets(line, sizeof(line), fp);

    while (fgets(line, sizeof(line), fp)) {
        char iface[50];

        sscanf(line,
               "%[^:]: %ld %*s %*s %*s %*s %*s %*s %*s %ld",
               iface,
               rx,
               tx);

        // ignora loopback
        if (strcmp(iface, "lo") != 0)
            break;
    }

    fclose(fp);
}

//////////////// TEMPERATURE //////////////////
float temperature() {
    DIR *dir = opendir("/sys/class/thermal");

    if (dir == NULL) {
        return -1;
    }

    struct dirent *entry;
    float max = -1;

    while ((entry = readdir(dir))) {

        if (strncmp(entry->d_name, "thermal_zone", 12) == 0) {

            char path[256];

            sprintf(path,
                    "/sys/class/thermal/%s/temp",
                    entry->d_name);

            FILE *fp = fopen(path, "r");

            int t;

            if (fp && fscanf(fp, "%d", &t) == 1) {

                float c = t / 1000.0;

                if (c > max)
                    max = c;

                fclose(fp);
            }
        }
    }

    closedir(dir);

    return max;
}

//////////////// MAIN //////////////////
int main() {

    long prev_idle = 0;
    long prev_total = 0;

    long prev_rx = 0;
    long prev_tx = 0;

    read_cpu(&prev_idle, &prev_total);
    network(&prev_rx, &prev_tx);

    while (1) {

        sleep(5);

        ////////////////// CPU //////////////////
        long curr_idle, curr_total;

        read_cpu(&curr_idle, &curr_total);

        float cpu =
            cpu_usage(prev_idle,
                      prev_total,
                      curr_idle,
                      curr_total);

        ////////////////// MEMORY //////////////////
        long total_mem = 0;
        long avail_mem = 0;

        memory(&total_mem, &avail_mem);

        ////////////////// DISK //////////////////
        char disk_info[256];

        disk(disk_info);

        ////////////////// NETWORK //////////////////
        long rx = 0;
        long tx = 0;

        network(&rx, &tx);

        ////////////////// TEMPERATURE //////////////////
        float temp = temperature();

        ////////////////// JSON //////////////////
        FILE *json = fopen("dados.json", "w");

        if (json == NULL) {
            printf("Erro ao criar JSON\n");
            return 1;
        }

        fprintf(json, "{\n");

        fprintf(json,
                "  \"cpu\": %.2f,\n",
                cpu);

        fprintf(json,
                "  \"memory\": {\n"
                "    \"total\": %ld,\n"
                "    \"used\": %ld,\n"
                "    \"available\": %ld\n"
                "  },\n",
                total_mem,
                total_mem - avail_mem,
                avail_mem);

        fprintf(json,
                "  \"disk\": \"%s\",\n",
                disk_info);

        fprintf(json,
                "  \"temperature\": %.2f,\n",
                temp);

        fprintf(json,
                "  \"network\": {\n"
                "    \"rx\": %ld,\n"
                "    \"tx\": %ld,\n"
                "    \"rx_rate\": %ld,\n"
                "    \"tx_rate\": %ld\n"
                "  }\n",
                rx,
                tx,
                rx - prev_rx,
                tx - prev_tx);

        fprintf(json, "}\n");

        fclose(json);

        ////////////////// TERMINAL //////////////////
        system("clear");

        printf("JSON atualizado com sucesso.\n");
        printf("CPU: %.2f%%\n", cpu);

        ////////////////// UPDATE VALUES //////////////////
        prev_idle = curr_idle;
        prev_total = curr_total;

        prev_rx = rx;
        prev_tx = tx;
    }

    return 0;
}