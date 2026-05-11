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

    fscanf(fp,
           "cpu %ld %ld %ld %ld %ld %ld %ld",
           &user,
           &nice,
           &system,
           idle,
           &iowait,
           &irq,
           &softirq);

    *idle += iowait;

    *total =
        user +
        nice +
        system +
        *idle +
        irq +
        softirq;

    fclose(fp);
}

float cpu_usage(long prev_idle,
                long prev_total,
                long curr_idle,
                long curr_total) {

    long total_diff =
        curr_total - prev_total;

    long idle_diff =
        curr_idle - prev_idle;

    if (total_diff == 0)
        return 0;

    return 100.0 *
           (total_diff - idle_diff) /
           total_diff;
}

//////////////// MEMORY //////////////////
void memory(long *total,
            long *available) {

    FILE *fp =
        fopen("/proc/meminfo", "r");

    if (fp == NULL) {
        return;
    }

    char line[128];

    while (fgets(line,
                 sizeof(line),
                 fp)) {

        sscanf(line,
               "MemTotal: %ld kB",
               total);

        sscanf(line,
               "MemAvailable: %ld kB",
               available);
    }

    fclose(fp);
}

//////////////// DISK //////////////////
void disk(char *total,
          char *used,
          char *available,
          char *usage_percent) {

    FILE *fp =
        popen("df -h / | tail -1", "r");

    if (fp == NULL) {
        return;
    }

    char filesystem[64];
    char mount[64];

    fscanf(fp,
           "%s %s %s %s %s %s",
           filesystem,
           total,
           used,
           available,
           usage_percent,
           mount);

    pclose(fp);
}

//////////////// NETWORK //////////////////
void network(long *rx,
             long *tx) {

    FILE *fp =
        fopen("/proc/net/dev", "r");

    if (fp == NULL) {
        return;
    }

    char line[256];

    fgets(line, sizeof(line), fp);
    fgets(line, sizeof(line), fp);

    while (fgets(line,
                 sizeof(line),
                 fp)) {

        char iface[50];

        sscanf(line,
               "%[^:]: %ld %*s %*s %*s %*s %*s %*s %*s %ld",
               iface,
               rx,
               tx);

        if (strcmp(iface, "lo") != 0)
            break;
    }

    fclose(fp);
}

//////////////// TEMPERATURE //////////////////
float temperature() {

    DIR *dir =
        opendir("/sys/class/thermal");

    if (dir == NULL) {
        return -1;
    }

    struct dirent *entry;

    float max = -1;

    while ((entry = readdir(dir))) {

        if (strncmp(entry->d_name,
                    "thermal_zone",
                    12) == 0) {

            char path[256];

            snprintf(path,
                     sizeof(path),
                     "/sys/class/thermal/%s/temp",
                     entry->d_name);

            FILE *fp =
                fopen(path, "r");

            int t;

            if (fp &&
                fscanf(fp, "%d", &t) == 1) {

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

//////////////// UPTIME //////////////////
long uptime() {

    FILE *fp = fopen("/proc/uptime", "r");

    if (fp == NULL)
        return 0;

    float up;

    fscanf(fp, "%f", &up);

    fclose(fp);

    return (long) up;
}

//////////////// PROCESS COUNT //////////////////
int process_count() {

    DIR *dir = opendir("/proc");

    if (dir == NULL)
        return 0;

    struct dirent *entry;

    int count = 0;

    while ((entry = readdir(dir)) != NULL) {

        if (entry->d_name[0] >= '0' &&
            entry->d_name[0] <= '9') {

            count++;
        }
    }

    closedir(dir);

    return count;
}

//////////////// THREAD COUNT //////////////////
int thread_count() {

    DIR *dir = opendir("/proc");

    if (dir == NULL)
        return 0;

    struct dirent *entry;

    int total_threads = 0;

    while ((entry = readdir(dir)) != NULL) {

        if (entry->d_name[0] >= '0' &&
            entry->d_name[0] <= '9') {

            char path[256];

            snprintf(path,
                     sizeof(path),
                     "/proc/%s/status",
                     entry->d_name);

            FILE *fp = fopen(path, "r");

            if (fp == NULL)
                continue;

            char line[256];

            while (fgets(line,
                         sizeof(line),
                         fp)) {

                int threads;

                if (sscanf(line,
                           "Threads: %d",
                           &threads) == 1) {

                    total_threads += threads;
                    break;
                }
            }

            fclose(fp);
        }
    }

    closedir(dir);

    return total_threads;
}

//////////////// PROCESS LIST //////////////////
void process_list(FILE *json) {

    DIR *dir = opendir("/proc");

    if (dir == NULL)
        return;

    struct dirent *entry;

    fprintf(json,
            "  \"process_list\": [\n");

    int first = 1;

    while ((entry = readdir(dir)) != NULL) {

        if (entry->d_name[0] >= '0' &&
            entry->d_name[0] <= '9') {

            int pid = atoi(entry->d_name);

            ////////////////// NAME //////////////////
            char name_path[256];

            snprintf(name_path,
                     sizeof(name_path),
                     "/proc/%s/comm",
                     entry->d_name);

            FILE *name_file =
                fopen(name_path, "r");

            if (name_file == NULL)
                continue;

            char name[128];

            fgets(name,
                  sizeof(name),
                  name_file);

            name[strcspn(name, "\n")] = 0;

            fclose(name_file);

            ////////////////// STATUS //////////////////
            char status_path[256];

            snprintf(status_path,
                     sizeof(status_path),
                     "/proc/%s/status",
                     entry->d_name);

            FILE *status_file =
                fopen(status_path, "r");

            if (status_file == NULL)
                continue;

            int threads = 0;

            char state[64] = "Unknown";

            char line[256];

            while (fgets(line,
                         sizeof(line),
                         status_file)) {

                sscanf(line,
                       "Threads: %d",
                       &threads);

                sscanf(line,
                       "State: %63[^\n]",
                       state);
            }

            fclose(status_file);

            ////////////////// JSON //////////////////
            if (!first)
                fprintf(json, ",\n");

            fprintf(json,
                    "    {\n"
                    "      \"pid\": %d,\n"
                    "      \"name\": \"%s\",\n"
                    "      \"threads\": %d,\n"
                    "      \"state\": \"%s\"\n"
                    "    }",
                    pid,
                    name,
                    threads,
                    state);

            first = 0;
        }
    }

    fprintf(json,
            "\n  ]\n");

    closedir(dir);
}

//////////////// MAIN //////////////////
int main() {

    long prev_idle = 0;
    long prev_total = 0;

    long prev_rx = 0;
    long prev_tx = 0;

    read_cpu(&prev_idle,
             &prev_total);

    network(&prev_rx,
            &prev_tx);

    while (1) {

        sleep(5);

        ////////////////// CPU //////////////////
        long curr_idle;
        long curr_total;

        read_cpu(&curr_idle,
                 &curr_total);

        float cpu =
            cpu_usage(prev_idle,
                      prev_total,
                      curr_idle,
                      curr_total);

        ////////////////// MEMORY //////////////////
        long total_mem = 0;
        long avail_mem = 0;

        memory(&total_mem,
               &avail_mem);

        ////////////////// DISK //////////////////
        char disk_total[32];
        char disk_used[32];
        char disk_available[32];
        char disk_percent[16];

        disk(disk_total,
            disk_used,
            disk_available,
            disk_percent);

        ////////////////// NETWORK //////////////////
        long rx = 0;
        long tx = 0;

        network(&rx,
                &tx);

        ////////////////// TEMPERATURE //////////////////
        float temp = temperature();

        ////////////////// UPTIME //////////////////
        long up = uptime();

        ////////////////// PROCESS / THREADS //////////////////
        int processes =
            process_count();

        int threads =
            thread_count();

        ////////////////// JSON //////////////////
        FILE *json =
            fopen("dados.json", "w");

        if (json == NULL) {

            printf("Erro ao criar JSON\n");

            return 1;
        }

        fprintf(json, "{\n");

        ////////////////// CPU //////////////////
        fprintf(json,
                "  \"cpu\": %.2f,\n",
                cpu);

        ////////////////// MEMORY //////////////////
        fprintf(json,
                "  \"memory\": {\n"
                "    \"total\": %ld,\n"
                "    \"used\": %ld,\n"
                "    \"available\": %ld\n"
                "  },\n",
                total_mem,
                total_mem - avail_mem,
                avail_mem);

        ////////////////// DISK //////////////////
        fprintf(json,
        "  \"disk\": {\n"
        "    \"total\": \"%s\",\n"
        "    \"used\": \"%s\",\n"
        "    \"available\": \"%s\",\n"
        "    \"usage_percent\": \"%s\"\n"
        "  },\n",
        disk_total,
        disk_used,
        disk_available,
        disk_percent);

        ////////////////// TEMPERATURE //////////////////
        fprintf(json,
                "  \"temperature\": %.2f,\n",
                temp);

        ////////////////// UPTIME //////////////////
        fprintf(json,
                "  \"uptime\": %ld,\n",
                up);

        ////////////////// PROCESS COUNT //////////////////
        fprintf(json,
                "  \"processes\": %d,\n",
                processes);

        ////////////////// THREAD COUNT //////////////////
        fprintf(json,
                "  \"threads\": %d,\n",
                threads);

        ////////////////// NETWORK //////////////////
        fprintf(json,
                "  \"network\": {\n"
                "    \"rx\": %ld,\n"
                "    \"tx\": %ld,\n"
                "    \"rx_rate\": %ld,\n"
                "    \"tx_rate\": %ld\n"
                "  },\n",
                rx,
                tx,
                rx - prev_rx,
                tx - prev_tx);

        ////////////////// PROCESS LIST //////////////////
        process_list(json);

        fprintf(json, "}\n");

        fclose(json);

        ////////////////// TERMINAL //////////////////
        system("clear");

        printf("JSON atualizado com sucesso.\n");

        ////////////////// UPDATE VALUES //////////////////
        prev_idle = curr_idle;
        prev_total = curr_total;

        prev_rx = rx;
        prev_tx = tx;
    }

    return 0;
}