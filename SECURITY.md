# Security Guide

This document outlines the security measures, threat model, and security controls implemented in the Clocked application.

## 🛡️ Security Overview

Clocked implements a defense-in-depth security strategy following OWASP ASVS (Application Security Verification Standard) and MASVS (Mobile Application Security Verification Standard) guidelines.

## 🎯 Threat Model (STRIDE)

### Spoofing
**Threat**: Unauthorized users impersonating legitimate users
**Controls**:
- Passwordless authentication with magic links
- OAuth integration with Google/Apple
- JWT tokens with short expiration (15 minutes)
- Refresh token rotation and family invalidation
- Rate limiting on authentication endpoints

### Tampering
**Threat**: Unauthorized modification of data
**Controls**:
- Input validation with Zod schemas
- Output encoding and sanitization
- Database constraints and foreign keys
- Row-level security (RLS) policies
- Audit logging for all data modifications
- Immutable audit trail

### Repudiation
**Threat**: Users denying actions they performed
**Controls**:
- Comprehensive audit logging
- Tamper-evident log entries
- User session tracking
- Action attribution with user IDs
- Immutable audit trail with timestamps

### Information Disclosure
**Threat**: Unauthorized access to sensitive data
**Controls**:
- Encryption in transit (TLS 1.3)
- Encryption at rest (AES-256)
- Row-level security policies
- Data minimization principles
- Privacy controls and user consent
- Secure storage for mobile tokens

### Denial of Service
**Threat**: Service unavailability
**Controls**:
- Rate limiting per IP and user
- Connection pooling and timeouts
- Resource quotas and limits
- Auto-scaling infrastructure
- DDoS protection (AWS Shield)
- Circuit breakers and graceful degradation

### Elevation of Privilege
**Threat**: Unauthorized privilege escalation
**Controls**:
- Role-based access control (RBAC)
- Principle of least privilege
- Permission checks at API and database levels
- Regular access reviews
- Secure default configurations

## 🔐 Authentication & Authorization

### Authentication Methods

#### Magic Link Authentication
- **Process**: User requests magic link → receives email → clicks link → authenticated
- **Security**: 
  - Links expire in 15 minutes
  - Single-use tokens
  - Rate limited to prevent abuse
  - Secure random token generation

#### OAuth Integration
- **Providers**: Google, Apple
- **Flow**: Authorization Code with PKCE
- **Security**:
  - State parameter for CSRF protection
  - Secure token exchange
  - Minimal scope requests

#### JWT Token Management
- **Access Tokens**: 15-minute expiration
- **Refresh Tokens**: 7-day expiration with rotation
- **Security**:
  - Strong secret key (256-bit)
  - Token family rotation on compromise
  - Secure storage in mobile apps
  - Server-side token validation

### Authorization Model

#### Role-Based Access Control (RBAC)
```
Owner (3) > Admin (2) > Member (1)
```

**Roles**:
- **Owner**: Full control over group, can delete group
- **Admin**: Manage members, invite users, moderate content
- **Member**: Participate in sessions, view group content

**Permission Matrix**:
| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Create Group | ✅ | ❌ | ❌ |
| Delete Group | ✅ | ❌ | ❌ |
| Invite Members | ✅ | ✅ | ❌ |
| Remove Members | ✅ | ✅ | ❌ |
| Start Session | ✅ | ✅ | ✅ |
| View Sessions | ✅ | ✅ | ✅ |
| Add Reactions | ✅ | ✅ | ✅ |

## 🗄️ Data Protection

### Encryption

#### In Transit
- **Protocol**: TLS 1.3
- **Ciphers**: AES-256-GCM, ChaCha20-Poly1305
- **Certificate**: Let's Encrypt with auto-renewal
- **HSTS**: Strict Transport Security enabled

#### At Rest
- **Database**: AES-256 encryption
- **File Storage**: S3 server-side encryption
- **Backups**: Encrypted with separate keys
- **Mobile Storage**: iOS Keychain, Android Keystore

### Data Minimization

#### Personal Data Collection
- **Required**: Email, handle, group memberships
- **Optional**: Profile photo, location (coarse), privacy settings
- **Not Collected**: Precise location, device identifiers, browsing history

#### Data Retention
- **User Data**: Retained while account is active
- **Session Data**: Retained for 2 years for analytics
- **Audit Logs**: Retained for 7 years (compliance)
- **Deleted Data**: Permanently removed within 30 days

### Privacy Controls

#### User Privacy Settings
- **Location Sharing**: Off by default, user-controlled
- **Activity Visibility**: Public, Friends, Private options
- **Leaderboard Participation**: Opt-in
- **Data Export**: Full data export available
- **Account Deletion**: Complete data removal

## 🏗️ Infrastructure Security

### Network Security

#### VPC Configuration
- **Public Subnets**: Load balancers only
- **Private Subnets**: Application servers and databases
- **NAT Gateways**: Outbound internet access for private resources
- **Security Groups**: Restrictive firewall rules

#### Network Segmentation
```
Internet → ALB → ECS (App) → RDS (Database)
                ↓
            ElastiCache (Redis)
```

### Container Security

#### Docker Security
- **Base Images**: Minimal Alpine Linux
- **User**: Non-root user (nodejs:1001)
- **Layers**: Multi-stage builds to reduce attack surface
- **Secrets**: No secrets in images, use AWS Secrets Manager

#### Runtime Security
- **Resource Limits**: CPU and memory constraints
- **Read-only Filesystem**: Where possible
- **No Privilege Escalation**: Containers run without privileges

### Database Security

#### PostgreSQL Security
- **Authentication**: Strong passwords, no default users
- **Network**: Only accessible from application subnets
- **Encryption**: TLS for connections, encryption at rest
- **Backups**: Encrypted daily backups with point-in-time recovery

#### Row-Level Security (RLS)
```sql
-- Users can only see their own data
CREATE POLICY "Users can view their own profile" ON "users"
    FOR SELECT USING (auth.uid()::text = id);

-- Group members can see group sessions
CREATE POLICY "Group members can view sessions" ON "sessions"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "group_members"
            WHERE group_id = "sessions".group_id
            AND user_id = auth.uid()::text
        )
    );
```

## 🔍 Security Monitoring

### Logging & Monitoring

#### Security Events
- **Authentication**: Login attempts, failures, token refresh
- **Authorization**: Permission denials, role changes
- **Data Access**: Sensitive data queries, exports
- **System Events**: Configuration changes, deployments

#### Log Format
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "event": "user_login",
  "userId": "user_123",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "success": true,
  "requestId": "req_456"
}
```

### Alerting

#### Security Alerts
- **Failed Login Attempts**: > 5 failures in 5 minutes
- **Privilege Escalation**: Unauthorized role changes
- **Data Exfiltration**: Unusual data access patterns
- **System Compromise**: Unexpected system changes

#### Response Procedures
1. **Immediate**: Automated blocking of suspicious IPs
2. **Short-term**: Security team notification
3. **Long-term**: Forensic analysis and remediation

## 🧪 Security Testing

### Automated Testing

#### Static Analysis
- **Code Scanning**: ESLint security rules, TypeScript strict mode
- **Dependency Scanning**: npm audit, Snyk integration
- **Container Scanning**: Trivy vulnerability scanning
- **Secret Scanning**: GitLeaks for exposed secrets

#### Dynamic Testing
- **API Testing**: Automated security tests for all endpoints
- **Penetration Testing**: Quarterly third-party assessments
- **Load Testing**: DDoS simulation and resilience testing

### Manual Testing

#### Security Checklist
- [ ] Authentication bypass attempts
- [ ] Authorization boundary testing
- [ ] Input validation testing
- [ ] Output encoding verification
- [ ] Session management testing
- [ ] Error handling verification

## 🚨 Incident Response

### Security Incident Classification

#### Severity Levels
- **Critical**: Data breach, system compromise
- **High**: Authentication bypass, privilege escalation
- **Medium**: Information disclosure, DoS
- **Low**: Minor vulnerabilities, policy violations

### Response Procedures

#### Immediate Response (0-1 hour)
1. **Containment**: Isolate affected systems
2. **Assessment**: Determine scope and impact
3. **Notification**: Alert security team and stakeholders

#### Short-term Response (1-24 hours)
1. **Investigation**: Forensic analysis
2. **Remediation**: Fix vulnerabilities
3. **Communication**: User notifications if required

#### Long-term Response (1-7 days)
1. **Recovery**: Restore normal operations
2. **Lessons Learned**: Post-incident review
3. **Prevention**: Implement additional controls

## 📋 Security Checklist

### Development
- [ ] Input validation on all endpoints
- [ ] Output encoding for all user data
- [ ] Authentication required for sensitive operations
- [ ] Authorization checks at API and database levels
- [ ] Secure error handling (no information disclosure)
- [ ] Rate limiting on all public endpoints
- [ ] HTTPS enforcement
- [ ] Secure headers (HSTS, CSP, etc.)

### Infrastructure
- [ ] VPC with private subnets
- [ ] Security groups with minimal access
- [ ] Encrypted storage and backups
- [ ] Secrets management (no hardcoded secrets)
- [ ] Monitoring and alerting configured
- [ ] Regular security updates
- [ ] Access logging enabled

### Operations
- [ ] Security monitoring active
- [ ] Incident response procedures documented
- [ ] Regular security assessments scheduled
- [ ] Staff security training completed
- [ ] Backup and recovery procedures tested
- [ ] Compliance requirements met

## 🔄 Security Updates

### Regular Activities
- **Weekly**: Dependency updates, security patches
- **Monthly**: Security review, access audit
- **Quarterly**: Penetration testing, security training
- **Annually**: Security architecture review, compliance audit

### Emergency Procedures
- **Critical Vulnerabilities**: Immediate patching within 24 hours
- **Zero-day Exploits**: Emergency response team activation
- **Data Breach**: Legal and regulatory notification procedures

## 📞 Security Contacts

- **Security Team**: security@clocked.app
- **Incident Response**: +1-XXX-XXX-XXXX
- **Bug Bounty**: security@clocked.app (subject: "Bug Bounty")
- **Compliance**: compliance@clocked.app

## 📚 References

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP MASVS](https://owasp.org/www-project-mobile-security-verification-standard/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [AWS Security Best Practices](https://aws.amazon.com/security/security-resources/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

*This security guide is reviewed and updated quarterly. Last updated: January 2024*
