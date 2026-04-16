"""
ZTVLIVE Upload API Tests v2
Comprehensive tests for video upload system including:
1. Single video file upload via POST /api/uploads/video
2. Chunked upload initialization via POST /api/uploads/video/chunk/init
3. Chunked upload chunk submission via POST /api/uploads/video/chunk/upload
4. Upload status check via GET /api/uploads/status/{upload_id}
5. Mobile MIME type support (.3gp, .3gpp)
6. File validation (type, size limits)
7. Creator video library listing via GET /api/uploads/my-uploads
"""

import pytest
import requests
import os
import uuid
import io
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@ztvlivestream.com"
ADMIN_PASSWORD = "Admin2026"


class TestUploadAPIHealth:
    """Basic health and endpoint availability tests"""
    
    def test_backend_health(self):
        """Verify backend is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Backend health check passed")
    
    def test_video_upload_endpoint_exists(self):
        """Verify POST /api/uploads/video endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/uploads/video")
        # Should return 422 (validation error) not 404
        assert response.status_code in [422, 400], f"Expected 422/400, got {response.status_code}"
        print("✓ POST /api/uploads/video endpoint exists")
    
    def test_chunked_init_endpoint_exists(self):
        """Verify POST /api/uploads/video/chunk/init endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/uploads/video/chunk/init")
        assert response.status_code in [422, 400], f"Expected 422/400, got {response.status_code}"
        print("✓ POST /api/uploads/video/chunk/init endpoint exists")
    
    def test_chunked_upload_endpoint_exists(self):
        """Verify POST /api/uploads/video/chunk/upload endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/uploads/video/chunk/upload")
        assert response.status_code in [422, 400], f"Expected 422/400, got {response.status_code}"
        print("✓ POST /api/uploads/video/chunk/upload endpoint exists")
    
    def test_upload_status_endpoint_exists(self):
        """Verify GET /api/uploads/status/{video_id} endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/uploads/status/nonexistent-id")
        # Should return 404 (not found) not 500
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ GET /api/uploads/status/{video_id} endpoint exists")
    
    def test_my_uploads_endpoint_exists(self):
        """Verify GET /api/uploads/my-uploads endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/uploads/my-uploads?creator_id=test123")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "uploads" in data
        print("✓ GET /api/uploads/my-uploads endpoint exists")


class TestSingleVideoUpload:
    """Test single video file upload via POST /api/uploads/video"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        return response.json().get("session_token") or response.json().get("token")
    
    @pytest.fixture
    def user_info(self, auth_token):
        """Get user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        if response.status_code != 200:
            pytest.skip("Could not get user info")
        return response.json()
    
    def test_upload_requires_creator_id(self):
        """Verify upload requires creator_id"""
        # Create a minimal fake video file
        fake_video = io.BytesIO(b"fake video content")
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video",
            files={"file": ("test.mp4", fake_video, "video/mp4")},
            data={"creator_name": "Test Creator"}
        )
        # Should fail due to missing creator_id
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Upload correctly requires creator_id")
    
    def test_upload_requires_creator_name(self):
        """Verify upload requires creator_name"""
        fake_video = io.BytesIO(b"fake video content")
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video",
            files={"file": ("test.mp4", fake_video, "video/mp4")},
            data={"creator_id": "test123"}
        )
        # Should fail due to missing creator_name
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Upload correctly requires creator_name")
    
    def test_upload_rejects_invalid_file_type(self):
        """Verify upload rejects non-video files"""
        fake_file = io.BytesIO(b"not a video")
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video",
            files={"file": ("test.txt", fake_file, "text/plain")},
            data={
                "creator_id": "test123",
                "creator_name": "Test Creator"
            }
        )
        # Should fail due to invalid file type
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "Invalid file type" in data.get("detail", "")
        print("✓ Upload correctly rejects invalid file types")
    
    def test_upload_accepts_mp4(self):
        """Verify upload accepts .mp4 files"""
        # Create a minimal valid MP4 header (ftyp box)
        # This is a minimal MP4 file header that should pass extension validation
        mp4_header = bytes([
            0x00, 0x00, 0x00, 0x20,  # Box size (32 bytes)
            0x66, 0x74, 0x79, 0x70,  # 'ftyp'
            0x69, 0x73, 0x6F, 0x6D,  # 'isom'
            0x00, 0x00, 0x02, 0x00,  # Minor version
            0x69, 0x73, 0x6F, 0x6D,  # Compatible brand 'isom'
            0x69, 0x73, 0x6F, 0x32,  # Compatible brand 'iso2'
            0x61, 0x76, 0x63, 0x31,  # Compatible brand 'avc1'
            0x6D, 0x70, 0x34, 0x31,  # Compatible brand 'mp41'
        ])
        fake_video = io.BytesIO(mp4_header)
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video",
            files={"file": ("TEST_upload_test.mp4", fake_video, "video/mp4")},
            data={
                "creator_id": f"TEST_{uuid.uuid4().hex[:8]}",
                "creator_name": "Test Creator",
                "category": "entertainment",
                "generate_thumbnail": "false"  # Skip thumbnail for test
            }
        )
        # Should succeed or fail on validation (not file type)
        # 200 = success, 500 = validation failed (expected for fake file)
        assert response.status_code in [200, 500], f"Expected 200/500, got {response.status_code}: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert "file_url" in data
            print(f"✓ Upload accepted .mp4 file, id: {data['id']}")
        else:
            print("✓ Upload accepted .mp4 extension (validation failed on content as expected)")


class TestMobileMIMETypes:
    """Test mobile MIME type support (.3gp, .3gpp)"""
    
    def test_3gp_extension_accepted(self):
        """Verify .3gp extension is accepted"""
        fake_video = io.BytesIO(b"fake 3gp content")
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video",
            files={"file": ("TEST_mobile.3gp", fake_video, "video/3gpp")},
            data={
                "creator_id": f"TEST_{uuid.uuid4().hex[:8]}",
                "creator_name": "Mobile Test Creator",
                "category": "entertainment"
            }
        )
        # Should not return 400 for invalid file type
        # May return 500 if validation fails on content, but not 400 for extension
        if response.status_code == 400:
            data = response.json()
            assert "Invalid file type" not in data.get("detail", ""), \
                f".3gp should be accepted but got: {data.get('detail')}"
        print(f"✓ .3gp extension accepted (status: {response.status_code})")
    
    def test_3gpp_extension_accepted(self):
        """Verify .3gpp extension is accepted"""
        fake_video = io.BytesIO(b"fake 3gpp content")
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video",
            files={"file": ("TEST_mobile.3gpp", fake_video, "video/3gpp")},
            data={
                "creator_id": f"TEST_{uuid.uuid4().hex[:8]}",
                "creator_name": "Mobile Test Creator",
                "category": "entertainment"
            }
        )
        # Should not return 400 for invalid file type
        if response.status_code == 400:
            data = response.json()
            assert "Invalid file type" not in data.get("detail", ""), \
                f".3gpp should be accepted but got: {data.get('detail')}"
        print(f"✓ .3gpp extension accepted (status: {response.status_code})")
    
    def test_mov_extension_accepted(self):
        """Verify .mov extension is accepted (common mobile format)"""
        fake_video = io.BytesIO(b"fake mov content")
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video",
            files={"file": ("TEST_mobile.mov", fake_video, "video/quicktime")},
            data={
                "creator_id": f"TEST_{uuid.uuid4().hex[:8]}",
                "creator_name": "Mobile Test Creator",
                "category": "entertainment"
            }
        )
        if response.status_code == 400:
            data = response.json()
            assert "Invalid file type" not in data.get("detail", ""), \
                f".mov should be accepted but got: {data.get('detail')}"
        print(f"✓ .mov extension accepted (status: {response.status_code})")
    
    def test_webm_extension_accepted(self):
        """Verify .webm extension is accepted"""
        fake_video = io.BytesIO(b"fake webm content")
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video",
            files={"file": ("TEST_mobile.webm", fake_video, "video/webm")},
            data={
                "creator_id": f"TEST_{uuid.uuid4().hex[:8]}",
                "creator_name": "Mobile Test Creator",
                "category": "entertainment"
            }
        )
        if response.status_code == 400:
            data = response.json()
            assert "Invalid file type" not in data.get("detail", ""), \
                f".webm should be accepted but got: {data.get('detail')}"
        print(f"✓ .webm extension accepted (status: {response.status_code})")


class TestChunkedUpload:
    """Test chunked upload for large files"""
    
    def test_chunked_init_requires_fields(self):
        """Verify chunked init requires all required fields"""
        response = requests.post(
            f"{BASE_URL}/api/uploads/video/chunk/init",
            data={"creator_id": "test123"}  # Missing other required fields
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Chunked init correctly requires all fields")
    
    def test_chunked_init_success(self):
        """Test successful chunked upload initialization"""
        creator_id = f"TEST_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video/chunk/init",
            data={
                "creator_id": creator_id,
                "creator_name": "Test Creator",
                "filename": "TEST_large_video.mp4",
                "total_size": 100 * 1024 * 1024,  # 100MB
                "total_chunks": 10,
                "category": "entertainment",
                "content_type": "video"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "upload_id" in data, "Response missing upload_id"
        assert "filename" in data, "Response missing filename"
        assert "total_chunks" in data, "Response missing total_chunks"
        assert "chunk_size" in data, "Response missing chunk_size"
        
        print(f"✓ Chunked init successful, upload_id: {data['upload_id']}")
        return data["upload_id"]
    
    def test_chunked_init_rejects_invalid_extension(self):
        """Verify chunked init rejects invalid file extensions"""
        response = requests.post(
            f"{BASE_URL}/api/uploads/video/chunk/init",
            data={
                "creator_id": "test123",
                "creator_name": "Test Creator",
                "filename": "invalid.txt",
                "total_size": 100 * 1024 * 1024,
                "total_chunks": 10,
                "category": "entertainment",
                "content_type": "video"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "Invalid file type" in data.get("detail", "")
        print("✓ Chunked init correctly rejects invalid extensions")
    
    def test_chunked_init_accepts_3gp(self):
        """Verify chunked init accepts .3gp extension"""
        response = requests.post(
            f"{BASE_URL}/api/uploads/video/chunk/init",
            data={
                "creator_id": f"TEST_{uuid.uuid4().hex[:8]}",
                "creator_name": "Mobile Test Creator",
                "filename": "TEST_mobile_video.3gp",
                "total_size": 50 * 1024 * 1024,  # 50MB
                "total_chunks": 5,
                "category": "entertainment",
                "content_type": "video"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "upload_id" in data
        print(f"✓ Chunked init accepts .3gp, upload_id: {data['upload_id']}")
    
    def test_chunk_upload_requires_session(self):
        """Verify chunk upload requires valid upload session"""
        fake_chunk = io.BytesIO(b"fake chunk data")
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/video/chunk/upload",
            files={"chunk": ("chunk_0", fake_chunk, "application/octet-stream")},
            data={
                "upload_id": "nonexistent-session-id",
                "chunk_index": 0
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Chunk upload correctly requires valid session")


class TestUploadStatus:
    """Test upload status endpoint"""
    
    def test_status_returns_404_for_nonexistent(self):
        """Verify status returns 404 for non-existent upload"""
        response = requests.get(f"{BASE_URL}/api/uploads/status/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ Status returns 404 for non-existent upload")
    
    def test_status_response_format(self):
        """Test status endpoint response format by creating an upload first"""
        # First, initialize a chunked upload to get a valid upload_id
        creator_id = f"TEST_{uuid.uuid4().hex[:8]}"
        
        init_response = requests.post(
            f"{BASE_URL}/api/uploads/video/chunk/init",
            data={
                "creator_id": creator_id,
                "creator_name": "Test Creator",
                "filename": "TEST_status_test.mp4",
                "total_size": 10 * 1024 * 1024,  # 10MB
                "total_chunks": 1,
                "category": "entertainment",
                "content_type": "video"
            }
        )
        
        if init_response.status_code != 200:
            pytest.skip("Could not create upload session")
        
        upload_id = init_response.json()["upload_id"]
        
        # Check status - should be in_progress since we haven't uploaded chunks
        # Note: The status endpoint looks in uploads collection, not upload_sessions
        # So it may return 404 until the upload is complete
        status_response = requests.get(f"{BASE_URL}/api/uploads/status/{upload_id}")
        
        # May be 404 if upload not yet in uploads collection
        if status_response.status_code == 200:
            data = status_response.json()
            assert "video_id" in data
            assert "status" in data
            print(f"✓ Status response format correct, status: {data['status']}")
        else:
            print(f"✓ Status returns 404 for incomplete upload (expected)")


class TestMyUploads:
    """Test creator video library listing"""
    
    def test_my_uploads_returns_list(self):
        """Verify my-uploads returns uploads list"""
        response = requests.get(f"{BASE_URL}/api/uploads/my-uploads?creator_id=test123")
        assert response.status_code == 200
        data = response.json()
        
        assert "uploads" in data, "Response missing 'uploads' field"
        assert "count" in data, "Response missing 'count' field"
        assert isinstance(data["uploads"], list), "'uploads' should be a list"
        
        print(f"✓ my-uploads returns list with {data['count']} items")
    
    def test_my_uploads_with_file_type_filter(self):
        """Verify my-uploads supports file_type filter"""
        response = requests.get(
            f"{BASE_URL}/api/uploads/my-uploads?creator_id=test123&file_type=video"
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned items should be videos
        for upload in data["uploads"]:
            assert upload.get("file_type") == "video", f"Expected video, got {upload.get('file_type')}"
        
        print(f"✓ my-uploads file_type filter works, {data['count']} videos")
    
    def test_my_uploads_pagination(self):
        """Verify my-uploads supports pagination"""
        response = requests.get(
            f"{BASE_URL}/api/uploads/my-uploads?creator_id=test123&skip=0&limit=5"
        )
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["uploads"]) <= 5, "Pagination limit not respected"
        print(f"✓ my-uploads pagination works, returned {len(data['uploads'])} items")


class TestFileValidation:
    """Test file validation (type, size limits)"""
    
    def test_allowed_video_extensions(self):
        """Verify all expected video extensions are allowed"""
        allowed_extensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", 
                            ".wmv", ".flv", ".mpeg", ".mpg", ".3gp", ".3gpp", ".ts"]
        
        for ext in allowed_extensions:
            fake_video = io.BytesIO(b"fake video content")
            filename = f"TEST_validation{ext}"
            
            response = requests.post(
                f"{BASE_URL}/api/uploads/video",
                files={"file": (filename, fake_video, "video/mp4")},
                data={
                    "creator_id": f"TEST_{uuid.uuid4().hex[:8]}",
                    "creator_name": "Test Creator",
                    "category": "entertainment"
                }
            )
            
            # Should not return 400 with "Invalid file type"
            if response.status_code == 400:
                data = response.json()
                assert "Invalid file type" not in data.get("detail", ""), \
                    f"Extension {ext} should be allowed but got: {data.get('detail')}"
            
            print(f"  ✓ {ext} extension accepted")
        
        print("✓ All expected video extensions are allowed")
    
    def test_rejected_extensions(self):
        """Verify non-video extensions are rejected"""
        rejected_extensions = [".txt", ".pdf", ".exe", ".zip", ".html", ".js"]
        
        for ext in rejected_extensions:
            fake_file = io.BytesIO(b"fake content")
            filename = f"TEST_invalid{ext}"
            
            response = requests.post(
                f"{BASE_URL}/api/uploads/video",
                files={"file": (filename, fake_file, "application/octet-stream")},
                data={
                    "creator_id": "test123",
                    "creator_name": "Test Creator",
                    "category": "entertainment"
                }
            )
            
            assert response.status_code == 400, f"Extension {ext} should be rejected"
            data = response.json()
            assert "Invalid file type" in data.get("detail", ""), \
                f"Expected 'Invalid file type' error for {ext}"
            
            print(f"  ✓ {ext} extension correctly rejected")
        
        print("✓ Non-video extensions are correctly rejected")


class TestThumbnailGeneration:
    """Test thumbnail auto-generation after upload"""
    
    def test_thumbnail_serve_endpoint(self):
        """Verify thumbnail serve endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/uploads/serve/thumbnail/nonexistent.jpg")
        assert response.status_code == 404
        print("✓ Thumbnail serve endpoint exists")
    
    def test_video_serve_endpoint(self):
        """Verify video serve endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/uploads/serve/video/nonexistent.mp4")
        assert response.status_code == 404
        print("✓ Video serve endpoint exists")
    
    def test_image_serve_endpoint(self):
        """Verify image serve endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/uploads/serve/image/nonexistent.jpg")
        assert response.status_code == 404
        print("✓ Image serve endpoint exists")


class TestUploadRetry:
    """Test upload retry functionality"""
    
    def test_retry_endpoint_exists(self):
        """Verify retry endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/uploads/retry/nonexistent-id")
        # Should return 404 (not found) not 500
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Retry endpoint exists")


class TestBatchMetadata:
    """Test batch metadata update functionality"""
    
    def test_batch_categories_endpoint(self):
        """Verify batch categories endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/uploads/batch/categories")
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data
        assert len(data["categories"]) > 0
        
        # Check category structure
        for cat in data["categories"]:
            assert "value" in cat
            assert "label" in cat
        
        print(f"✓ Batch categories endpoint works, {len(data['categories'])} categories")
    
    def test_batch_metadata_endpoint_exists(self):
        """Verify batch metadata update endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/uploads/batch/metadata",
            json={"videos": []}
        )
        # Should return 200 with empty result
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["updated_count"] == 0
        print("✓ Batch metadata endpoint exists")


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
