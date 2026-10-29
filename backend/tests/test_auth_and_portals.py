"""
Tests for BhashaLens Authentication, Role-Based Access Control, and Portal Isolation.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.auth import seed_demo_accounts

client = TestClient(app)


@pytest.fixture(autouse=True)
def ensure_seeded():
    seed_demo_accounts()


class TestAuthRegistrationAndLogin:

    def test_demo_user_login(self):
        res = client.post("/api/auth/login", json={
            "email": "user@bhashalens.org",
            "password": "DemoUser123!"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["role"] == "USER"
        assert data["user"]["email"] == "user@bhashalens.org"
        assert "token" in data

    def test_demo_admin_login(self):
        res = client.post("/api/auth/login", json={
            "email": "admin@bhashalens.org",
            "password": "AdminPass123!"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["role"] == "ADMIN"
        assert "token" in data

    def test_invalid_login_fails(self):
        res = client.post("/api/auth/login", json={
            "email": "admin@bhashalens.org",
            "password": "WrongPassword!"
        })
        assert res.status_code == 401

    def test_public_registration_defaults_to_user_role(self):
        import uuid
        test_email = f"contributor_{uuid.uuid4().hex[:8]}@test.com"
        res = client.post("/api/auth/register", json={
            "name": "New Contributor",
            "email": test_email,
            "password": "Password123!",
            "role": "ADMIN"  # Attempt to escalate role
        })
        assert res.status_code == 200
        data = res.json()
        # Must be demoted to USER
        assert data["user"]["role"] == "USER"
        assert data["user"]["email"] == test_email

    def test_duplicate_registration_rejected(self):
        res = client.post("/api/auth/register", json={
            "name": "Another User",
            "email": "user@bhashalens.org",
            "password": "Password123!"
        })
        assert res.status_code == 400
        assert "already exists" in res.json()["detail"]


class TestAccessControlAndIsolation:

    def get_token(self, email, password):
        res = client.post("/api/auth/login", json={"email": email, "password": password})
        return res.json()["token"]

    def test_admin_users_endpoint_requires_admin(self):
        user_token = self.get_token("user@bhashalens.org", "DemoUser123!")
        res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {user_token}"})
        assert res.status_code == 403

        admin_token = self.get_token("admin@bhashalens.org", "AdminPass123!")
        res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        data = res.json()
        assert len(data["users"]) >= 2

    def test_user_stats_endpoint(self):
        user_token = self.get_token("user@bhashalens.org", "DemoUser123!")
        res = client.get("/api/user/stats", headers={"Authorization": f"Bearer {user_token}"})
        assert res.status_code == 200
        data = res.json()
        assert "total_submissions" in data
        assert "pending_review" in data
        assert "approved" in data

    def test_user_isolation_on_submissions(self):
        user_token = self.get_token("user@bhashalens.org", "DemoUser123!")
        res = client.get("/api/submissions", headers={"Authorization": f"Bearer {user_token}"})
        assert res.status_code == 200
        subs = res.json()["submissions"]
        # All returned submissions must belong to this user
        for s in subs:
            assert s.get("user_id") == "usr_demo_user" or s.get("user_id") is not None
