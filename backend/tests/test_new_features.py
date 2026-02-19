"""
Backend API tests for new features:
- Calculator modal services (calc-services-public)
- PDF generation for leads
- Block Constructor (site-blocks management, fetch from site, import)
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://leads-calculator.preview.emergentagent.com')

class TestHealthAndAuth:
    """Basic health check and authentication"""
    
    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✅ Health check passed")
    
    def test_login_success(self):
        """Test login with admin/gototop2026"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "gototop2026"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == "admin"
        print("✅ Login successful")
        return data["token"]


class TestCalcServicesPublic:
    """Tests for calculator services public endpoint"""
    
    def test_calc_services_public_endpoint(self):
        """Test /api/calc-services-public returns tabs and services"""
        response = requests.get(f"{BASE_URL}/api/calc-services-public")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "tabs" in data
        assert "services" in data
        assert isinstance(data["tabs"], list)
        assert isinstance(data["services"], list)
        
        print(f"✅ Calc services public: {len(data['tabs'])} tabs, {len(data['services'])} services")
        
        # Verify tabs have expected fields
        if len(data["tabs"]) > 0:
            tab = data["tabs"][0]
            assert "id" in tab
            assert "name_ru" in tab
            assert "tab_key" in tab
            print(f"  First tab: {tab['name_ru']}")
        
        # Verify services have expected fields
        if len(data["services"]) > 0:
            service = data["services"][0]
            assert "id" in service
            assert "name_ru" in service
            assert "price" in service
            assert "tab_id" in service
            assert "tab_name_ru" in service
            print(f"  First service: {service['name_ru']} - {service['price']}֏")
        
        return data


class TestPDFGeneration:
    """Tests for PDF generation endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "gototop2026"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Auth failed")
    
    def test_generate_pdf_endpoint(self, auth_token):
        """Test PDF generation with calc items"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get a lead to attach PDF to
        leads_response = requests.get(f"{BASE_URL}/api/leads?limit=5", headers=headers)
        assert leads_response.status_code == 200
        leads_data = leads_response.json()
        
        if len(leads_data.get("leads", [])) == 0:
            pytest.skip("No leads available for PDF test")
        
        lead_id = leads_data["leads"][0]["id"]
        lead_name = leads_data["leads"][0].get("name", "Test")
        
        # Generate PDF
        pdf_payload = {
            "lead_id": lead_id,
            "client_name": lead_name,
            "lang": "ru",
            "items": [
                {"name": "Выкуп товара", "qty": 2, "price": 5000, "sum": 10000},
                {"name": "SEO оптимизация", "qty": 1, "price": 15000, "sum": 15000}
            ],
            "total": 25000
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-pdf", json=pdf_payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "pdf_url" in data
        assert "pdf_id" in data
        assert data["pdf_url"].startswith("/api/uploads/")
        
        print(f"✅ PDF generated: {data['pdf_url']}")
        
        # Verify PDF is accessible
        pdf_response = requests.get(f"{BASE_URL}{data['pdf_url']}")
        assert pdf_response.status_code == 200
        assert "pdf" in pdf_response.headers.get("content-type", "").lower() or len(pdf_response.content) > 0
        print(f"✅ PDF is accessible and has content ({len(pdf_response.content)} bytes)")
        
        return data["pdf_url"]


class TestSiteBlocks:
    """Tests for site blocks management"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "gototop2026"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Auth failed")
    
    def test_list_site_blocks(self, auth_token):
        """Test listing site blocks"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/site-blocks", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "blocks" in data
        assert isinstance(data["blocks"], list)
        print(f"✅ Site blocks list: {len(data['blocks'])} blocks")
        
        return data["blocks"]
    
    def test_fetch_from_site(self, auth_token):
        """Test fetching blocks from external site"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{BASE_URL}/api/site-blocks/fetch-from-site", 
                                 json={"url": "https://gototop.win"},
                                 headers=headers,
                                 timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "blocks" in data
        assert isinstance(data["blocks"], list)
        assert len(data["blocks"]) > 0
        
        # Verify block structure
        block = data["blocks"][0]
        assert "block_key" in block
        assert "title_ru" in block
        assert "texts_ru" in block
        
        print(f"✅ Fetched {len(data['blocks'])} blocks from site")
        print(f"  First block: {block['title_ru']}")
        
        return data["blocks"]
    
    def test_create_site_block(self, auth_token):
        """Test creating a new site block"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        block_payload = {
            "block_key": f"test_block_{os.urandom(4).hex()}",
            "block_type": "section",
            "title_ru": "Тестовый блок",
            "title_am": "Test block",
            "texts_ru": ["Тестовый текст 1", "Тестовый текст 2"],
            "texts_am": ["Test text 1", "Test text 2"],
            "images": [],
            "buttons": [{"text_ru": "Кнопка", "text_am": "Button", "url": "https://example.com"}],
            "is_visible": True
        }
        
        response = requests.post(f"{BASE_URL}/api/site-blocks", json=block_payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["title_ru"] == block_payload["title_ru"]
        assert data["block_key"] == block_payload["block_key"]
        
        print(f"✅ Created block: {data['id']} - {data['title_ru']}")
        
        # Cleanup - delete the test block
        delete_response = requests.delete(f"{BASE_URL}/api/site-blocks/{data['id']}", headers=headers)
        assert delete_response.status_code == 200
        print(f"✅ Cleaned up test block")
        
        return data
    
    def test_import_blocks(self, auth_token):
        """Test importing multiple blocks"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        blocks_to_import = [
            {
                "block_key": f"import_test_{os.urandom(4).hex()}",
                "block_type": "section",
                "title_ru": "Импортированный блок 1",
                "title_am": "",
                "texts_ru": ["Текст 1"],
                "texts_am": [],
                "images": [],
                "buttons": [],
                "is_visible": True,
                "sort_order": 100
            },
            {
                "block_key": f"import_test_{os.urandom(4).hex()}",
                "block_type": "section",
                "title_ru": "Импортированный блок 2",
                "title_am": "",
                "texts_ru": ["Текст 2"],
                "texts_am": [],
                "images": [],
                "buttons": [],
                "is_visible": True,
                "sort_order": 101
            }
        ]
        
        response = requests.post(f"{BASE_URL}/api/site-blocks/import",
                                 json={"blocks": blocks_to_import},
                                 headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["imported"] == 2
        
        print(f"✅ Imported {data['imported']} blocks")
        
        return data
    
    def test_reorder_blocks(self, auth_token):
        """Test reordering blocks"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get current blocks
        blocks_response = requests.get(f"{BASE_URL}/api/site-blocks", headers=headers)
        blocks = blocks_response.json().get("blocks", [])
        
        if len(blocks) < 2:
            pytest.skip("Need at least 2 blocks for reorder test")
        
        # Reverse order for test
        orders = [{"id": b["id"], "sort_order": len(blocks) - i} for i, b in enumerate(blocks[:5])]
        
        response = requests.post(f"{BASE_URL}/api/site-blocks/reorder",
                                 json={"orders": orders},
                                 headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        print(f"✅ Reordered {len(orders)} blocks")


class TestLeadsWithCalcData:
    """Tests for leads with calculator data"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "gototop2026"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Auth failed")
    
    def test_lead_with_calc_data(self, auth_token):
        """Test that leads can store calc_data JSON"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        calc_data = json.dumps({
            "items": [
                {"name": "Service 1", "qty": 2, "price": 1000, "sum": 2000},
                {"name": "Service 2", "qty": 1, "price": 3000, "sum": 3000}
            ],
            "total": 5000,
            "pdf_url": "/api/uploads/test.pdf"
        })
        
        # Create lead with calc_data
        lead_payload = {
            "name": "TEST_CalcDataLead",
            "contact": "+374991234567",
            "source": "calculator_pdf",
            "total_amount": 5000,
            "calc_data": calc_data
        }
        
        create_response = requests.post(f"{BASE_URL}/api/leads", json=lead_payload, headers=headers)
        assert create_response.status_code == 200
        created = create_response.json()
        
        assert "id" in created
        assert created["calc_data"] == calc_data
        assert created["total_amount"] == 5000
        
        print(f"✅ Created lead with calc_data: {created['id']}")
        
        # Verify calc_data is returned in list
        list_response = requests.get(f"{BASE_URL}/api/leads?limit=50", headers=headers)
        leads = list_response.json().get("leads", [])
        test_lead = next((l for l in leads if l["id"] == created["id"]), None)
        
        assert test_lead is not None
        assert test_lead["calc_data"] == calc_data
        
        print(f"✅ Lead calc_data persisted correctly")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/leads/{created['id']}", headers=headers)
        assert delete_response.status_code == 200
        print(f"✅ Cleaned up test lead")


class TestFileUpload:
    """Tests for file upload endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "gototop2026"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Auth failed")
    
    def test_upload_image(self, auth_token):
        """Test image upload endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a simple test image (1x1 pixel PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {"file": ("test.png", png_data, "image/png")}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "url" in data
        assert data["url"].startswith("/api/uploads/")
        
        print(f"✅ Uploaded image: {data['url']}")
        
        # Verify file is accessible
        file_response = requests.get(f"{BASE_URL}{data['url']}")
        assert file_response.status_code == 200
        print(f"✅ Uploaded file is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
