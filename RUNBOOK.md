# Operations Runbook

This runbook provides operational procedures, troubleshooting guides, and incident response protocols for the Clocked application.

## 🚨 Emergency Contacts

### On-Call Rotation
- **Primary**: +1-XXX-XXX-XXXX (John Doe)
- **Secondary**: +1-XXX-XXX-XXXX (Jane Smith)
- **Escalation**: +1-XXX-XXX-XXXX (Engineering Manager)
- **Security**: security@clocked.app

### Communication Channels
- **Slack**: #alerts, #incidents, #on-call
- **PagerDuty**: Automatic escalation
- **Email**: alerts@clocked.app

## 📊 Health Checks

### Application Health
```bash
# API Health Check
curl -f https://api.clocked.app/health

# Expected Response
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Database Health
```bash
# PostgreSQL Connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# Redis Connection
redis-cli -h $REDIS_HOST ping
```

### Infrastructure Health
```bash
# ECS Service Status
aws ecs describe-services --cluster clocked-cluster --services clocked-app-service

# RDS Status
aws rds describe-db-instances --db-instance-identifier clocked-db

# ElastiCache Status
aws elasticache describe-replication-groups --replication-group-id clocked-redis
```

## 🔧 Common Operations

### Application Deployment

#### Staging Deployment
```bash
# Trigger staging deployment
git push origin develop

# Monitor deployment
aws logs tail /ecs/clocked-app --follow

# Verify deployment
curl -f https://staging-api.clocked.app/health
```

#### Production Deployment
```bash
# Create release tag
git tag v1.0.1
git push origin v1.0.1

# Monitor deployment
aws logs tail /ecs/clocked-app --follow

# Verify deployment
curl -f https://api.clocked.app/health
```

### Database Operations

#### Backup Database
```bash
# Create manual backup
aws rds create-db-snapshot \
  --db-instance-identifier clocked-db \
  --db-snapshot-identifier clocked-manual-$(date +%Y%m%d-%H%M%S)
```

#### Restore Database
```bash
# List available snapshots
aws rds describe-db-snapshots --db-instance-identifier clocked-db

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier clocked-db-restored \
  --db-snapshot-identifier clocked-manual-20240101-120000
```

#### Run Database Migrations
```bash
# Connect to ECS task
aws ecs execute-command \
  --cluster clocked-cluster \
  --task $TASK_ID \
  --container clocked-server \
  --interactive \
  --command "/bin/sh"

# Run migrations
npx prisma migrate deploy
```

### Scaling Operations

#### Scale ECS Service
```bash
# Scale up
aws ecs update-service \
  --cluster clocked-cluster \
  --service clocked-app-service \
  --desired-count 5

# Scale down
aws ecs update-service \
  --cluster clocked-cluster \
  --service clocked-app-service \
  --desired-count 2
```

#### Update Auto Scaling
```bash
# Update auto scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/clocked-cluster/clocked-app-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10
```

## 🚨 Incident Response

### Severity Levels

#### P0 - Critical
- **Definition**: Complete service outage, data breach, security incident
- **Response Time**: 15 minutes
- **Escalation**: Immediate to engineering manager and security team
- **Communication**: Public status page update

#### P1 - High
- **Definition**: Significant service degradation, major feature broken
- **Response Time**: 1 hour
- **Escalation**: On-call engineer + team lead
- **Communication**: Internal Slack notification

#### P2 - Medium
- **Definition**: Minor feature issues, performance degradation
- **Response Time**: 4 hours
- **Escalation**: On-call engineer
- **Communication**: Internal ticket

#### P3 - Low
- **Definition**: Cosmetic issues, minor bugs
- **Response Time**: 24 hours
- **Escalation**: Regular support queue
- **Communication**: Internal ticket

### Incident Response Process

#### 1. Detection and Assessment (0-15 minutes)
```bash
# Check service status
curl -f https://api.clocked.app/health

# Check logs
aws logs tail /ecs/clocked-app --follow --since 10m

# Check metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=clocked-app-service \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

#### 2. Communication (0-30 minutes)
- **Slack**: Post in #incidents channel
- **Status Page**: Update if P0/P1 incident
- **Stakeholders**: Notify relevant teams

#### 3. Investigation and Resolution (15 minutes - 4 hours)
- **Root Cause Analysis**: Identify the underlying cause
- **Workaround**: Implement temporary fix if possible
- **Permanent Fix**: Deploy proper solution
- **Verification**: Confirm resolution

#### 4. Post-Incident (24-48 hours)
- **Incident Report**: Document what happened
- **Lessons Learned**: Identify improvements
- **Action Items**: Create tasks to prevent recurrence

### Common Incidents

#### High CPU Usage
```bash
# Check CPU metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=clocked-app-service \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Scale up if needed
aws ecs update-service \
  --cluster clocked-cluster \
  --service clocked-app-service \
  --desired-count 5
```

#### Database Connection Issues
```bash
# Check database status
aws rds describe-db-instances --db-instance-identifier clocked-db

# Check connection pool
aws logs filter-log-events \
  --log-group-name /ecs/clocked-app \
  --filter-pattern "database connection"

# Restart service if needed
aws ecs update-service \
  --cluster clocked-cluster \
  --service clocked-app-service \
  --force-new-deployment
```

#### Memory Leaks
```bash
# Check memory usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name MemoryUtilization \
  --dimensions Name=ServiceName,Value=clocked-app-service \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Restart service
aws ecs update-service \
  --cluster clocked-cluster \
  --service clocked-app-service \
  --force-new-deployment
```

## 🔍 Monitoring and Alerting

### Key Metrics

#### Application Metrics
- **Response Time**: P95 < 500ms, P99 < 1000ms
- **Error Rate**: < 0.1% (4xx/5xx responses)
- **Throughput**: Requests per second
- **Availability**: > 99.9% uptime

#### Infrastructure Metrics
- **CPU Utilization**: < 80% average
- **Memory Utilization**: < 85% average
- **Database Connections**: < 80% of max connections
- **Disk Usage**: < 85% of allocated storage

#### Business Metrics
- **Active Users**: Daily and monthly active users
- **Session Creation**: Sessions started per hour
- **Group Activity**: Groups created, members joined
- **Feature Usage**: Most used features and endpoints

### Alerting Rules

#### Critical Alerts
```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"

# Database connection issues
- alert: DatabaseConnectionIssues
  expr: database_connections_active / database_connections_max > 0.9
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Database connection pool nearly exhausted"
```

#### Warning Alerts
```yaml
# High response time
- alert: HighResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High response time detected"

# High CPU usage
- alert: HighCPUUsage
  expr: cpu_usage_percent > 80
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High CPU usage detected"
```

### Dashboard Queries

#### Grafana Dashboards
- **Application Overview**: Response time, error rate, throughput
- **Infrastructure**: CPU, memory, disk, network
- **Database**: Connections, queries, locks, replication lag
- **Business Metrics**: Users, sessions, groups, features

## 🛠️ Troubleshooting

### Application Issues

#### Slow Response Times
1. **Check CPU/Memory**: High resource usage
2. **Database Queries**: Slow or blocking queries
3. **External Dependencies**: Third-party service issues
4. **Code Issues**: Inefficient algorithms or memory leaks

#### High Error Rates
1. **Check Logs**: Look for error patterns
2. **Database Issues**: Connection problems, deadlocks
3. **External Services**: API failures, timeouts
4. **Configuration**: Missing environment variables

#### Memory Issues
1. **Memory Leaks**: Objects not being garbage collected
2. **Large Datasets**: Loading too much data into memory
3. **Caching Issues**: Inefficient cache usage
4. **Resource Limits**: Container memory limits too low

### Database Issues

#### Connection Pool Exhaustion
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check connection limits
SHOW max_connections;

-- Kill long-running queries
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' 
AND query_start < now() - interval '5 minutes';
```

#### Slow Queries
```sql
-- Find slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check for table locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Analyze table statistics
ANALYZE;
```

#### Replication Lag
```sql
-- Check replication lag
SELECT client_addr, state, 
       pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) AS lag_bytes
FROM pg_stat_replication;
```

### Infrastructure Issues

#### ECS Service Issues
```bash
# Check service status
aws ecs describe-services --cluster clocked-cluster --services clocked-app-service

# Check task health
aws ecs describe-tasks --cluster clocked-cluster --tasks $TASK_ID

# Check task logs
aws logs tail /ecs/clocked-app --follow
```

#### Load Balancer Issues
```bash
# Check target health
aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN

# Check load balancer metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=$LOAD_BALANCER_ARN \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## 📋 Maintenance Procedures

### Regular Maintenance

#### Weekly Tasks
- [ ] Review error logs and metrics
- [ ] Check database performance and slow queries
- [ ] Verify backup integrity
- [ ] Update dependencies (security patches)
- [ ] Review security alerts and incidents

#### Monthly Tasks
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Log rotation and cleanup
- [ ] Security audit and penetration testing
- [ ] Performance review and optimization
- [ ] Disaster recovery testing

#### Quarterly Tasks
- [ ] Infrastructure review and optimization
- [ ] Security policy updates
- [ ] Capacity planning and scaling review
- [ ] Documentation updates
- [ ] Team training and knowledge sharing

### Backup and Recovery

#### Database Backups
```bash
# Automated daily backups (configured in RDS)
# Manual backup creation
aws rds create-db-snapshot \
  --db-instance-identifier clocked-db \
  --db-snapshot-identifier clocked-manual-$(date +%Y%m%d-%H%M%S)

# Backup verification
aws rds describe-db-snapshots \
  --db-snapshot-identifier clocked-manual-20240101-120000
```

#### Application Data Backups
```bash
# Export user data
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --data-only --table=users --table=sessions \
  --table=groups --table=group_members \
  > user_data_backup_$(date +%Y%m%d).sql

# Upload to S3
aws s3 cp user_data_backup_$(date +%Y%m%d).sql \
  s3://clocked-backups/database/
```

#### Disaster Recovery Testing
```bash
# Test restore procedure
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier clocked-db-test \
  --db-snapshot-identifier clocked-manual-20240101-120000

# Verify data integrity
psql -h $TEST_DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT count(*) FROM users;"
```

## 📞 Escalation Procedures

### On-Call Escalation
1. **Level 1**: On-call engineer (0-15 minutes)
2. **Level 2**: Team lead (15-30 minutes)
3. **Level 3**: Engineering manager (30-60 minutes)
4. **Level 4**: CTO (60+ minutes for P0 incidents)

### External Escalation
- **AWS Support**: For infrastructure issues
- **Security Team**: For security incidents
- **Legal Team**: For compliance or legal issues
- **PR Team**: For public communication

### Communication Templates

#### Incident Notification
```
🚨 INCIDENT ALERT - P1
Service: Clocked API
Issue: High error rate (5.2%)
Time: 2024-01-01 12:00 UTC
Status: Investigating
ETA: 30 minutes
```

#### Resolution Update
```
✅ INCIDENT RESOLVED - P1
Service: Clocked API
Issue: High error rate (5.2%)
Resolution: Restarted ECS service, cleared connection pool
Duration: 25 minutes
Root Cause: Database connection leak
```

## 📚 Knowledge Base

### Common Commands
```bash
# View recent logs
aws logs tail /ecs/clocked-app --follow --since 1h

# Check service health
curl -f https://api.clocked.app/health

# Scale service
aws ecs update-service --cluster clocked-cluster --service clocked-app-service --desired-count 3

# Check database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

### Useful Links
- **AWS Console**: https://console.aws.amazon.com
- **Grafana**: https://grafana.clocked.app
- **Status Page**: https://status.clocked.app
- **Documentation**: https://docs.clocked.app

---

*This runbook is updated regularly. Last updated: January 2024*
