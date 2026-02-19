import requests
import sys
import json
from datetime import datetime

class GoToTopAPITester:
    def __init__(self, base_url="https://b25a4dbe-c8b9-497e-8d46-73724d9986f1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.user_id = None
        self.test_user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if self.token:
            default_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers)

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

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "/api/health", 200)

    def test_login(self, username="admin", password="gototop2026"):
        """Test login and get token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/api/auth/login",
            200,
            data={"username": username, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"🔑 Token obtained, user ID: {self.user_id}")
            return True
        return False

    def test_get_me(self):
        """Test get current user endpoint"""
        success, response = self.run_test("Get Current User", "GET", "/api/auth/me", 200)
        if success:
            print(f"👤 User: {response.get('display_name')} ({response.get('role')})")
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        return self.run_test("Dashboard Stats", "GET", "/api/dashboard/stats", 200)

    def test_config_roles(self):
        """Test roles config endpoint"""
        return self.run_test("Roles Config", "GET", "/api/config/roles", 200)

    def test_list_users(self):
        """Test list users endpoint"""
        return self.run_test("List Users", "GET", "/api/users", 200)

    def test_create_user(self):
        """Test create user endpoint"""
        timestamp = datetime.now().strftime("%H%M%S")
        test_data = {
            "username": f"test_user_{timestamp}",
            "password": "testpass123",
            "display_name": f"Test User {timestamp}",
            "role": "operator",
            "phone": "+374999999",
            "email": f"test{timestamp}@example.com"
        }
        success, response = self.run_test("Create User", "POST", "/api/users", 200, data=test_data)
        if success and 'id' in response:
            self.test_user_id = response['id']
            print(f"👤 Created test user with ID: {self.test_user_id}")
        return success

    def test_update_user(self):
        """Test update user endpoint"""
        if not self.test_user_id:
            print("⚠️ Skipping update user test - no test user created")
            return True
        
        update_data = {
            "display_name": "Updated Test User",
            "role": "analyst"
        }
        return self.run_test("Update User", "PUT", f"/api/users/{self.test_user_id}", 200, data=update_data)

    def test_get_user_permissions(self):
        """Test get user permissions"""
        if not self.test_user_id:
            print("⚠️ Skipping permissions test - no test user created")
            return True
            
        return self.run_test("Get User Permissions", "GET", f"/api/permissions/{self.test_user_id}", 200)

    def test_update_permissions(self):
        """Test update user permissions"""
        if not self.test_user_id:
            print("⚠️ Skipping update permissions test - no test user created")
            return True
            
        permissions_data = {"sections": ["dashboard", "leads", "analytics"]}
        return self.run_test("Update Permissions", "PUT", f"/api/permissions/{self.test_user_id}", 200, data=permissions_data)

    def test_reset_password(self):
        """Test reset user password"""
        if not self.test_user_id:
            print("⚠️ Skipping reset password test - no test user created")
            return True
            
        return self.run_test("Reset User Password", "POST", f"/api/users/{self.test_user_id}/reset-password", 200)

    def test_create_lead(self):
        """Test create lead endpoint"""
        lead_data = {
            "name": "Test Lead",
            "contact": "+374999999999",
            "product": "Test Product",
            "service": "Test Service",
            "message": "Test message for lead",
            "source": "test"
        }
        success, response = self.run_test("Create Lead", "POST", "/api/leads", 200, data=lead_data)
        if success and 'id' in response:
            self.test_lead_id = response['id']
            print(f"📋 Created test lead with ID: {self.test_lead_id}")
        return success

    def test_list_leads(self):
        """Test list leads endpoint"""
        return self.run_test("List Leads", "GET", "/api/leads", 200)

    def test_list_leads_with_filter(self):
        """Test list leads with status filter"""
        return self.run_test("List Leads (new)", "GET", "/api/leads?status=new", 200)

    def test_update_lead(self):
        """Test update lead endpoint"""
        if not hasattr(self, 'test_lead_id'):
            print("⚠️ Skipping update lead test - no test lead created")
            return True
            
        update_data = {
            "status": "in_progress",
            "notes": "Updated notes",
            "assigned_to": self.user_id
        }
        return self.run_test("Update Lead", "PUT", f"/api/leads/{self.test_lead_id}", 200, data=update_data)

    def test_public_lead_submission(self):
        """Test public lead submission endpoint"""
        lead_data = {
            "name": "Public Lead",
            "contact": "public@example.com",
            "product": "Public Product",
            "service": "Public Service",
            "message": "Public lead message",
            "source": "form"
        }
        return self.run_test("Public Lead Submission", "POST", "/api/lead", 200, data=lead_data)

    def test_change_password(self):
        """Test change password endpoint"""
        password_data = {
            "current_password": "gototop2026",
            "new_password": "gototop2026"  # Change back to same password
        }
        return self.run_test("Change Password", "POST", "/api/auth/change-password", 200, data=password_data)

    def test_activity_log(self):
        """Test activity log endpoint"""
        return self.run_test("Activity Log", "GET", "/api/activity", 200)

    def test_delete_lead(self):
        """Test delete lead endpoint"""
        if not hasattr(self, 'test_lead_id'):
            print("⚠️ Skipping delete lead test - no test lead created")
            return True
            
        return self.run_test("Delete Lead", "DELETE", f"/api/leads/{self.test_lead_id}", 200)

    def test_delete_user(self):
        """Test delete user endpoint"""
        if not self.test_user_id:
            print("⚠️ Skipping delete user test - no test user created")
            return True
            
        return self.run_test("Delete User", "DELETE", f"/api/users/{self.test_user_id}", 200)

    def test_unauthorized_access(self):
        """Test unauthorized access"""
        old_token = self.token
        self.token = None
        success = not self.run_test("Unauthorized Access", "GET", "/api/users", 401)[0]
        self.token = old_token
        if success:
            self.tests_passed += 1
            print("✅ Unauthorized access properly blocked")
        else:
            self.failed_tests.append("Unauthorized access test failed")
        return success

def main():
    """Run all API tests"""
    print("🚀 Starting Go to Top API Tests...")
    print("=" * 50)
    
    tester = GoToTopAPITester()
    
    # Core functionality tests
    tests = [
        tester.test_health_check,
        tester.test_login,
        tester.test_get_me,
        tester.test_dashboard_stats,
        tester.test_config_roles,
        tester.test_unauthorized_access,
        
        # User management tests
        tester.test_list_users,
        tester.test_create_user,
        tester.test_update_user,
        tester.test_get_user_permissions,
        tester.test_update_permissions,
        tester.test_reset_password,
        
        # Lead management tests
        tester.test_public_lead_submission,
        tester.test_create_lead,
        tester.test_list_leads,
        tester.test_list_leads_with_filter,
        tester.test_update_lead,
        tester.test_delete_lead,
        
        # Settings and activity
        tester.test_change_password,
        tester.test_activity_log,
        
        # Cleanup
        tester.test_delete_user,
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {str(e)}")
            tester.failed_tests.append(f"{test.__name__}: Crashed - {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 API TEST RESULTS:")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Tests failed: {len(tester.failed_tests)}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            print(f"   - {failure}")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())