# -*- coding: utf-8 -*-
"""
PythonAnywhere WSGI configuration file for Orbit platform.
This file allows PythonAnywhere Web Tab to run your Orbit app directly.
"""

import sys
import os

# Add application directory to python path
path = os.path.dirname(os.path.abspath(__file__))
if path not in sys.path:
    sys.path.append(path)

from app import app as application
