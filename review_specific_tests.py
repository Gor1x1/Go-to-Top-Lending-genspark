#!/usr/bin/env python3
"""
Specific tests for the review request features:
1. Employee creation flow: create testuser2 with role 'analyst'
2. Role-based access: login as operator and verify restricted sections
3. Permissions management: change permissions for testoperator
4. Lead creation and full CRM flow
5. Password reset for employee via admin
6. Employee deactivation/activation toggle
7. Lead filtering by status
"""

import requests
import sys
import json
from datetime import datetime

class ReviewSpecificTester:
    def __init__(self, base_url="https://b25a4dbe-c8b9-497e-8d46-73724d9986f1.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.operator_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.testuser2_id = None
        self.testoperator_id = None
        self.test_lead_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except:
                    return success, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail.get('detail', error_detail)}"
                except:
                    error_msg += f" - {response.text[:200]}"
                print(f"❌ Failed - {error_msg}")
                self.failed_tests.append(f"{name}: {error_msg}")
                return False, {}

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            print(f"❌ Failed - {error_msg}")
            self.failed_tests.append(f"{name}: {error_msg}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login", "POST", "/api/auth/login", 200,
            data={"username": "admin", "password": "gototop2026"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"🔑 Admin token obtained")
            return True
        return False

    def test_create_testuser2_analyst(self):
        """Create testuser2 with role 'analyst' and verify appears in list"""
        user_data = {
            "username": "testuser2",
            "password": "test123456",
            "display_name": "Test User 2 Analyst",
            "role": "analyst",
            "phone": "+374999001",
            "email": "testuser2@example.com"
        }
        
        success, response = self.run_test(
            "Create testuser2 (analyst)", "POST", "/api/users", 200,
            data=user_data, token=self.admin_token
        )
        
        if success and 'id' in response:
            self.testuser2_id = response['id']
            print(f"👤 Created testuser2 with ID: {self.testuser2_id}")
            
            # Verify user appears in list
            list_success, list_response = self.run_test(
                "Verify testuser2 in list", "GET", "/api/users", 200,
                token=self.admin_token
            )
            
            if list_success:
                users = list_response
                found = any(u.get('username') == 'testuser2' and u.get('role') == 'analyst' 
                          for u in users)
                if found:
                    print(f"✅ testuser2 with analyst role found in user list")
                    return True
                else:
                    print(f"❌ testuser2 not found in user list")
                    self.failed_tests.append("testuser2 not found in user list after creation")
            
        return False

    def test_create_testoperator_if_needed(self):
        """Create testoperator if it doesn't exist"""
        # First try to login as testoperator
        success, response = self.run_test(
            "Try login as testoperator", "POST", "/api/auth/login", 200,
            data={"username": "testoperator", "password": "test123456"}
        )
        
        if success:
            print("✅ testoperator already exists")
            return True
        
        # Create testoperator if doesn't exist
        user_data = {
            "username": "testoperator",
            "password": "test123456", 
            "display_name": "Test Operator",
            "role": "operator",
            "phone": "+374999002",
            "email": "testoperator@example.com"
        }
        
        success, response = self.run_test(
            "Create testoperator", "POST", "/api/users", 200,
            data=user_data, token=self.admin_token
        )
        
        if success and 'id' in response:
            self.testoperator_id = response['id']
            print(f"👤 Created testoperator with ID: {self.testoperator_id}")
            return True
        return False

    def test_operator_login_and_restrictions(self):
        """Login as operator and verify restricted sections"""
        success, response = self.run_test(
            "Operator Login", "POST", "/api/auth/login", 200,
            data={"username": "testoperator", "password": "test123456"}
        )
        
        if not success:
            return False
        
        self.operator_token = response['token']
        operator_user = response['user']
        print(f"🔑 Operator token obtained for {operator_user.get('display_name')}")
        
        # Check operator permissions
        permissions = operator_user.get('permissions', [])
        expected_perms = ['dashboard', 'leads', 'orders']  # Default operator permissions
        
        print(f"📋 Operator permissions: {permissions}")
        
        # Test access to allowed section (dashboard)
        dashboard_success, _ = self.run_test(
            "Operator access dashboard (allowed)", "GET", "/api/dashboard/stats", 200,
            token=self.operator_token
        )
        
        # Test access to restricted section (employees) - should fail
        employees_fail, _ = self.run_test(
            "Operator access employees (restricted)", "GET", "/api/users", 403,
            token=self.operator_token
        )
        
        # Test access to another restricted section (permissions) - should fail
        perms_fail, _ = self.run_test(
            "Operator access permissions (restricted)", "GET", f"/api/permissions/{operator_user['id']}", 403,
            token=self.operator_token
        )
        
        return dashboard_success and employees_fail and perms_fail

    def test_change_operator_permissions(self):
        """Change permissions for testoperator and verify changes saved"""
        if not self.testoperator_id:
            # Try to find testoperator ID
            list_success, users = self.run_test("Get users for operator ID", "GET", "/api/users", 200, token=self.admin_token)
            if list_success:
                for u in users:
                    if u.get('username') == 'testoperator':
                        self.testoperator_id = u['id']
                        break
        
        if not self.testoperator_id:
            print("⚠️ Cannot find testoperator ID")
            return False
        
        # Update permissions to include employees section
        new_perms = ["dashboard", "leads", "orders", "employees"]
        success, _ = self.run_test(
            "Update testoperator permissions", "PUT", f"/api/permissions/{self.testoperator_id}", 200,
            data={"sections": new_perms}, token=self.admin_token
        )
        
        if not success:
            return False
        
        # Verify permissions were saved
        verify_success, response = self.run_test(
            "Verify updated permissions", "GET", f"/api/permissions/{self.testoperator_id}", 200,
            token=self.admin_token
        )
        
        if verify_success:
            saved_perms = response.get('permissions', [])
            if set(saved_perms) == set(new_perms):
                print(f"✅ Permissions updated and verified: {saved_perms}")
                return True
            else:
                print(f"❌ Permissions mismatch. Expected: {new_perms}, Got: {saved_perms}")
                self.failed_tests.append(f"Permission update failed - expected {new_perms}, got {saved_perms}")
        
        return False

    def test_create_lead_and_crm_flow(self):
        """Create lead, change status, assign to user, add notes"""
        # Create initial lead
        lead_data = {
            "name": "CRM Test Lead",
            "contact": "+374999000111",
            "product": "CRM Test Product",
            "service": "CRM Test Service", 
            "message": "Test message for CRM flow",
            "source": "manual"
        }
        
        success, response = self.run_test(
            "Create lead for CRM flow", "POST", "/api/leads", 200,
            data=lead_data, token=self.admin_token
        )
        
        if not success or 'id' not in response:
            return False
        
        self.test_lead_id = response['id']
        print(f"📋 Created CRM test lead with ID: {self.test_lead_id}")
        
        # Change status to in_progress
        update1_success, _ = self.run_test(
            "Update lead status", "PUT", f"/api/leads/{self.test_lead_id}", 200,
            data={"status": "in_progress"}, token=self.admin_token
        )
        
        # Assign to testuser2 (if available) or admin
        assignee_id = self.testuser2_id or "admin_id"  # Fallback to admin
        update2_success, _ = self.run_test(
            "Assign lead to user", "PUT", f"/api/leads/{self.test_lead_id}", 200,
            data={"assigned_to": assignee_id}, token=self.admin_token
        )
        
        # Add notes
        update3_success, _ = self.run_test(
            "Add notes to lead", "PUT", f"/api/leads/{self.test_lead_id}", 200,
            data={"notes": "CRM flow test notes - updated successfully"}, token=self.admin_token
        )
        
        # Verify all changes were applied
        verify_success, lead_data = self.run_test(
            "Verify CRM changes", "GET", f"/api/leads", 200,
            token=self.admin_token
        )
        
        if verify_success:
            leads = lead_data.get('leads', [])
            test_lead = next((l for l in leads if l.get('id') == self.test_lead_id), None)
            
            if test_lead:
                status_ok = test_lead.get('status') == 'in_progress'
                notes_ok = 'CRM flow test notes' in test_lead.get('notes', '')
                assigned_ok = test_lead.get('assigned_to') == assignee_id
                
                if status_ok and notes_ok and assigned_ok:
                    print(f"✅ CRM flow completed successfully")
                    return True
                else:
                    print(f"❌ CRM flow verification failed - status:{status_ok}, notes:{notes_ok}, assigned:{assigned_ok}")
        
        return update1_success and update2_success and update3_success

    def test_password_reset_for_employee(self):
        """Password reset for employee via admin"""
        if not self.testuser2_id:
            print("⚠️ No testuser2 to reset password for")
            return True
        
        success, response = self.run_test(
            "Reset testuser2 password", "POST", f"/api/users/{self.testuser2_id}/reset-password", 200,
            token=self.admin_token
        )
        
        if success and 'new_password' in response:
            new_password = response['new_password']
            print(f"🔑 New password generated: {new_password}")
            
            # Try to login with new password
            login_success, _ = self.run_test(
                "Login with new password", "POST", "/api/auth/login", 200,
                data={"username": "testuser2", "password": new_password}
            )
            
            return login_success
        
        return False

    def test_employee_deactivation_activation(self):
        """Employee deactivation/activation toggle"""
        if not self.testuser2_id:
            print("⚠️ No testuser2 to deactivate/activate")
            return True
        
        # Deactivate user
        deactivate_success, _ = self.run_test(
            "Deactivate testuser2", "PUT", f"/api/users/{self.testuser2_id}", 200,
            data={"is_active": False}, token=self.admin_token
        )
        
        # Verify user cannot login when deactivated
        login_fail, _ = self.run_test(
            "Try login when deactivated", "POST", "/api/auth/login", 401,
            data={"username": "testuser2", "password": "test123456"}
        )
        
        # Reactivate user
        activate_success, _ = self.run_test(
            "Reactivate testuser2", "PUT", f"/api/users/{self.testuser2_id}", 200,
            data={"is_active": True}, token=self.admin_token
        )
        
        # Verify user can login again
        login_success, _ = self.run_test(
            "Login after reactivation", "POST", "/api/auth/login", 200,
            data={"username": "testuser2", "password": "test123456"}
        )
        
        return deactivate_success and login_fail and activate_success and login_success

    def test_lead_filtering_by_status(self):
        """Test lead filtering by status (new, in_progress, completed, etc)"""
        statuses_to_test = ['new', 'in_progress', 'completed', 'cancelled']
        
        all_success = True
        
        for status in statuses_to_test:
            success, response = self.run_test(
                f"Filter leads by {status}", "GET", f"/api/leads?status={status}", 200,
                token=self.admin_token
            )
            
            if success:
                leads = response.get('leads', [])
                # Verify all returned leads have the requested status
                if status != 'all':
                    wrong_status = [l for l in leads if l.get('status') != status]
                    if wrong_status:
                        print(f"❌ Found leads with wrong status in {status} filter: {len(wrong_status)}")
                        all_success = False
                    else:
                        print(f"✅ All {len(leads)} leads have status '{status}'")
            else:
                all_success = False
        
        return all_success

def main():
    """Run all review-specific tests"""
    print("🚀 Starting Review-Specific Tests...")
    print("=" * 60)
    
    tester = ReviewSpecificTester()
    
    # Test sequence matching review requirements
    tests = [
        ("Admin Login", tester.test_admin_login),
        ("Employee creation: testuser2 analyst", tester.test_create_testuser2_analyst),
        ("Create testoperator if needed", tester.test_create_testoperator_if_needed),
        ("Role-based access: operator restrictions", tester.test_operator_login_and_restrictions),
        ("Permissions management: change testoperator", tester.test_change_operator_permissions),
        ("Lead creation and CRM flow", tester.test_create_lead_and_crm_flow),
        ("Password reset for employee", tester.test_password_reset_for_employee),
        ("Employee deactivation/activation", tester.test_employee_deactivation_activation),
        ("Lead filtering by status", tester.test_lead_filtering_by_status),
    ]
    
    # Run all tests
    for test_name, test_func in tests:
        try:
            print(f"\n{'='*20} {test_name} {'='*20}")
            test_func()
        except Exception as e:
            print(f"❌ Test {test_name} crashed: {str(e)}")
            tester.failed_tests.append(f"{test_name}: Crashed - {str(e)}")
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 REVIEW-SPECIFIC TEST RESULTS:")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Tests failed: {len(tester.failed_tests)}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            print(f"   - {failure}")
    else:
        print(f"\n🎉 All review requirements working perfectly!")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())