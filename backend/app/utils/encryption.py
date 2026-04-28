import base64
import os
from typing import Dict, Optional, Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

_master_keys: Optional[Dict[str, bytes]] = None
_aesgcm_instances: Dict[str, AESGCM] = {}


def _get_master_keys() -> Dict[str, bytes]:
    global _master_keys
    if _master_keys is not None:
        return _master_keys
    result: Dict[str, bytes] = {}
    for i, key_hex in enumerate(settings.master_keys_list):
        key_id = f"mk-{str(i + 1).zfill(3)}"
        try:
            result[key_id] = bytes.fromhex(key_hex)
        except ValueError as e:
            raise ValueError(f"Invalid master key format at index {i}: {e}")
    _master_keys = result
    return _master_keys


def _get_master_key(kid: str) -> bytes:
    keys = _get_master_keys()
    if kid not in keys:
        raise ValueError(f"Master key with KID {kid} not found")
    return keys[kid]


def _get_aesgcm(kid: str) -> AESGCM:
    if kid not in _aesgcm_instances:
        key = _get_master_key(kid)
        _aesgcm_instances[kid] = AESGCM(key)
    return _aesgcm_instances[kid]


def _get_current_key() -> Tuple[str, bytes]:
    kid = settings.CURRENT_MASTER_KID
    key = _get_master_key(kid)
    return kid, key


def _get_key_by_kid(kid: str) -> bytes:
    return _get_master_key(kid)


def encrypt_for_storage(plaintext: str) -> Tuple[str, str]:
    kid, _ = _get_current_key()
    aesgcm = _get_aesgcm(kid)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    encrypted_data = base64.b64encode(nonce + ciphertext).decode("utf-8")
    return encrypted_data, kid


def decrypt_for_display(encrypted_data: str, kid: str) -> Optional[str]:
    try:
        aesgcm = _get_aesgcm(kid)
        raw_data = base64.b64decode(encrypted_data)
        nonce = raw_data[:12]
        ciphertext = raw_data[12:]
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")
    except Exception:
        return None
