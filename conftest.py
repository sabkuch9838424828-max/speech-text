"""
Root-level conftest.py so pytest can be run from the repo root
(c:\Users\ASUS\Desktop\flux1) and still find the backend app package.
"""
import sys
import os

# Add the backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
