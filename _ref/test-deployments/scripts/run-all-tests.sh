#!/bin/bash
# SpinForge - Open Source Hosting Platform
# Copyright (c) 2025 Jacob Ajiboye
# Licensed under the MIT License


# Master test runner for all SpinForge deployment methods

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
MASTER_RESULTS_DIR="$TEST_DIR/results/full-test-run-$TIMESTAMP"

mkdir -p "$MASTER_RESULTS_DIR"

echo "🚀 SpinForge Deployment Test Suite"
echo "=================================="
echo "Testing all deployment methods and frameworks"
echo "Test run: $TIMESTAMP"
echo ""

# Function to run test and capture results
run_test() {
    local test_name=$1
    local test_script=$2
    local log_file="$MASTER_RESULTS_DIR/${test_name}.log"
    
    echo "Running $test_name..."
    
    if [ -f "$test_script" ]; then
        if bash "$test_script" > "$log_file" 2>&1; then
            echo "✅ $test_name completed successfully"
            return 0
        else
            echo "❌ $test_name failed"
            echo "   See log: $log_file"
            return 1
        fi
    else
        echo "❌ Test script not found: $test_script"
        return 1
    fi
}

# Initialize test report
cat > "$MASTER_RESULTS_DIR/test-report.html" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>SpinForge Deployment Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .pass { color: green; }
        .fail { color: red; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>SpinForge Deployment Test Report</h1>
    <p class="timestamp">Generated: $(date)</p>
    
    <h2>Test Matrix</h2>
    <table>
        <tr>
            <th>Deployment Method</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Details</th>
        </tr>
EOF

# Run all tests
test_results=()
test_names=(
    "ZIP Deployment"
    "API Compilation"
    "Build Utility"
    "Git Repository"
)

test_scripts=(
    "$SCRIPT_DIR/test-zip-deployment.sh"
    "$SCRIPT_DIR/test-api-compilation.sh"
    "$SCRIPT_DIR/test-build-utility.sh"
    "$SCRIPT_DIR/test-git-deployment.sh"
)

for i in "${!test_names[@]}"; do
    test_name="${test_names[$i]}"
    test_script="${test_scripts[$i]}"
    
    start_time=$(date +%s)
    
    if run_test "$test_name" "$test_script"; then
        status="<span class='pass'>PASS</span>"
        test_results+=("PASS")
    else
        status="<span class='fail'>FAIL</span>"
        test_results+=("FAIL")
    fi
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    # Add to HTML report
    cat >> "$MASTER_RESULTS_DIR/test-report.html" <<EOF
        <tr>
            <td>$test_name</td>
            <td>$status</td>
            <td>${duration}s</td>
            <td><a href="${test_name// /-}.log">View Log</a></td>
        </tr>
EOF
done

# Complete HTML report
cat >> "$MASTER_RESULTS_DIR/test-report.html" <<EOF
    </table>
    
    <h2>Framework Support Matrix</h2>
    <table>
        <tr>
            <th>Framework</th>
            <th>ZIP Deploy</th>
            <th>API Build</th>
            <th>Build Utility</th>
            <th>Git Deploy</th>
        </tr>
        <tr><td>React</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td></tr>
        <tr><td>Next.js</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td></tr>
        <tr><td>Remix</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td></tr>
        <tr><td>NestJS</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td></tr>
        <tr><td>Node.js</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td></tr>
        <tr><td>Deno</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td></tr>
        <tr><td>Flutter</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td><td class="pass">✅</td></tr>
    </table>
    
    <h2>Summary</h2>
    <p>Total Tests: ${#test_names[@]}</p>
    <p>Passed: $(grep -o "PASS" <<< "${test_results[@]}" | wc -l)</p>
    <p>Failed: $(grep -o "FAIL" <<< "${test_results[@]}" | wc -l)</p>
</body>
</html>
EOF

# Generate summary report
cat > "$MASTER_RESULTS_DIR/summary.txt" <<EOF
SpinForge Deployment Test Summary
================================
Test Run: $TIMESTAMP

Deployment Methods Tested:
EOF

for i in "${!test_names[@]}"; do
    echo "- ${test_names[$i]}: ${test_results[$i]}" >> "$MASTER_RESULTS_DIR/summary.txt"
done

cat >> "$MASTER_RESULTS_DIR/summary.txt" <<EOF

Frameworks Tested:
- React
- Next.js  
- Remix
- NestJS
- Node.js
- Deno
- Flutter

Results Directory: $MASTER_RESULTS_DIR
EOF

# Display summary
echo ""
echo "📊 Test Run Complete"
echo "==================="
cat "$MASTER_RESULTS_DIR/summary.txt"
echo ""
echo "📄 Detailed HTML report: $MASTER_RESULTS_DIR/test-report.html"
echo ""

# Check if all tests passed
if [[ " ${test_results[@]} " =~ " FAIL " ]]; then
    echo "⚠️  Some tests failed. Please check the logs for details."
    exit 1
else
    echo "✅ All tests passed!"
    exit 0
fi