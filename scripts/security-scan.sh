#!/bin/bash

# Security Scanning Script for Clocked Application
# This script runs comprehensive security scans and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPORT_DIR="./security-reports"
DATE=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/security-scan-$DATE.md"

# Create report directory
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}🔍 Starting Security Scan for Clocked Application${NC}"
echo -e "${BLUE}Report will be saved to: $REPORT_FILE${NC}"
echo ""

# Initialize report
cat > "$REPORT_FILE" << EOF
# Security Scan Report - Clocked Application

**Scan Date**: $(date)
**Scan Version**: 1.0.0
**Target**: Clocked Application

## Executive Summary

This report contains the results of comprehensive security scanning for the Clocked application.

## Scan Results

EOF

# Function to add section to report
add_section() {
    echo "" >> "$REPORT_FILE"
    echo "### $1" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
}

# Function to add result to report
add_result() {
    echo "- $1" >> "$REPORT_FILE"
}

# Function to run command and capture output
run_scan() {
    local name="$1"
    local command="$2"
    local output_file="$REPORT_DIR/${name}-${DATE}.txt"
    
    echo -e "${YELLOW}Running $name...${NC}"
    
    if eval "$command" > "$output_file" 2>&1; then
        echo -e "${GREEN}✅ $name completed successfully${NC}"
        add_result "✅ $name: PASSED"
    else
        echo -e "${RED}❌ $name failed${NC}"
        add_result "❌ $name: FAILED"
    fi
    
    echo "  Output saved to: $output_file"
    echo ""
}

# 1. Dependency Scanning
echo -e "${BLUE}📦 Running Dependency Scans...${NC}"
add_section "Dependency Scanning"

# npm audit
run_scan "npm-audit" "npm audit --audit-level moderate"

# Snyk scan (if available)
if command -v snyk &> /dev/null; then
    run_scan "snyk-scan" "snyk test"
else
    echo -e "${YELLOW}⚠️  Snyk not installed, skipping...${NC}"
    add_result "⚠️  Snyk: SKIPPED (not installed)"
fi

# 2. Code Scanning
echo -e "${BLUE}🔍 Running Code Scans...${NC}"
add_section "Code Scanning"

# ESLint security rules
run_scan "eslint-security" "npx eslint . --ext .ts,.tsx,.js,.jsx --config .eslintrc.js"

# TypeScript strict mode check
run_scan "typescript-check" "npx tsc --noEmit --strict"

# 3. Secret Scanning
echo -e "${BLUE}🔐 Running Secret Scans...${NC}"
add_section "Secret Scanning"

# GitLeaks
if command -v gitleaks &> /dev/null; then
    run_scan "gitleaks" "gitleaks detect --source . --verbose"
else
    echo -e "${YELLOW}⚠️  GitLeaks not installed, skipping...${NC}"
    add_result "⚠️  GitLeaks: SKIPPED (not installed)"
fi

# TruffleHog
if command -v trufflehog &> /dev/null; then
    run_scan "trufflehog" "trufflehog filesystem ."
else
    echo -e "${YELLOW}⚠️  TruffleHog not installed, skipping...${NC}"
    add_result "⚠️  TruffleHog: SKIPPED (not installed)"
fi

# 4. Container Scanning
echo -e "${BLUE}🐳 Running Container Scans...${NC}"
add_section "Container Scanning"

# Trivy
if command -v trivy &> /dev/null; then
    # Scan server Dockerfile
    if [ -f "./server/Dockerfile" ]; then
        run_scan "trivy-server" "trivy image --input ./server/Dockerfile"
    fi
    
    # Scan mobile Dockerfile
    if [ -f "./mobile/Dockerfile" ]; then
        run_scan "trivy-mobile" "trivy image --input ./mobile/Dockerfile"
    fi
else
    echo -e "${YELLOW}⚠️  Trivy not installed, skipping...${NC}"
    add_result "⚠️  Trivy: SKIPPED (not installed)"
fi

# 5. Infrastructure Scanning
echo -e "${BLUE}🏗️  Running Infrastructure Scans...${NC}"
add_section "Infrastructure Scanning"

# Terraform security scan
if command -v tfsec &> /dev/null; then
    run_scan "tfsec" "tfsec ./infra"
else
    echo -e "${YELLOW}⚠️  tfsec not installed, skipping...${NC}"
    add_result "⚠️  tfsec: SKIPPED (not installed)"
fi

# Checkov
if command -v checkov &> /dev/null; then
    run_scan "checkov" "checkov -d ./infra"
else
    echo -e "${YELLOW}⚠️  Checkov not installed, skipping...${NC}"
    add_result "⚠️  Checkov: SKIPPED (not installed)"
fi

# 6. Security Headers Check
echo -e "${BLUE}🛡️  Checking Security Headers...${NC}"
add_section "Security Headers"

# Check if server is running
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    run_scan "security-headers" "curl -I http://localhost:3000/health | grep -E '(X-|Strict-|Content-Security)'"
else
    echo -e "${YELLOW}⚠️  Server not running, skipping security headers check...${NC}"
    add_result "⚠️  Security Headers: SKIPPED (server not running)"
fi

# 7. SSL/TLS Configuration
echo -e "${BLUE}🔒 Checking SSL/TLS Configuration...${NC}"
add_section "SSL/TLS Configuration"

# SSL Labs API (if available)
if [ -n "$SSL_LABS_API_KEY" ]; then
    run_scan "ssl-labs" "curl -s \"https://api.ssllabs.com/api/v3/analyze?host=api.clocked.app&publish=off&startNew=on\""
else
    echo -e "${YELLOW}⚠️  SSL Labs API key not set, skipping...${NC}"
    add_result "⚠️  SSL Labs: SKIPPED (API key not set)"
fi

# 8. OWASP ZAP Scan (if available)
echo -e "${BLUE}🕷️  Running OWASP ZAP Scan...${NC}"
add_section "OWASP ZAP Scan"

if command -v zap-baseline.py &> /dev/null; then
    run_scan "zap-baseline" "zap-baseline.py -t http://localhost:3000"
else
    echo -e "${YELLOW}⚠️  OWASP ZAP not installed, skipping...${NC}"
    add_result "⚠️  OWASP ZAP: SKIPPED (not installed)"
fi

# 9. Generate Summary
echo -e "${BLUE}📊 Generating Summary...${NC}"

# Count results
TOTAL_SCANS=$(grep -c "✅\|❌\|⚠️" "$REPORT_FILE" || echo "0")
PASSED_SCANS=$(grep -c "✅" "$REPORT_FILE" || echo "0")
FAILED_SCANS=$(grep -c "❌" "$REPORT_FILE" || echo "0")
SKIPPED_SCANS=$(grep -c "⚠️" "$REPORT_FILE" || echo "0")

# Add summary to report
cat >> "$REPORT_FILE" << EOF

## Summary

- **Total Scans**: $TOTAL_SCANS
- **Passed**: $PASSED_SCANS
- **Failed**: $FAILED_SCANS
- **Skipped**: $SKIPPED_SCANS

## Recommendations

EOF

# Add recommendations based on results
if [ "$FAILED_SCANS" -gt 0 ]; then
    echo "- Address all failed security scans before deployment" >> "$REPORT_FILE"
    echo "- Review failed scan outputs for remediation steps" >> "$REPORT_FILE"
fi

if [ "$SKIPPED_SCANS" -gt 0 ]; then
    echo "- Install missing security tools for comprehensive scanning" >> "$REPORT_FILE"
    echo "- Consider running skipped scans in CI/CD pipeline" >> "$REPORT_FILE"
fi

echo "- Run security scans regularly (weekly)" >> "$REPORT_FILE"
echo "- Integrate security scanning into CI/CD pipeline" >> "$REPORT_FILE"
echo "- Review and update security policies quarterly" >> "$REPORT_FILE"

# Add footer
cat >> "$REPORT_FILE" << EOF

## Next Steps

1. Review all scan results
2. Address any critical or high severity findings
3. Update security policies if needed
4. Schedule next security scan

---

*Generated by Clocked Security Scan Script v1.0.0*
EOF

# Display final results
echo ""
echo -e "${BLUE}📋 Security Scan Complete!${NC}"
echo -e "${GREEN}✅ Passed: $PASSED_SCANS${NC}"
echo -e "${RED}❌ Failed: $FAILED_SCANS${NC}"
echo -e "${YELLOW}⚠️  Skipped: $SKIPPED_SCANS${NC}"
echo ""
echo -e "${BLUE}📄 Full report saved to: $REPORT_FILE${NC}"

# Exit with error code if any scans failed
if [ "$FAILED_SCANS" -gt 0 ]; then
    echo -e "${RED}❌ Security scan completed with failures. Please review the report.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Security scan completed successfully!${NC}"
    exit 0
fi
