// ==UserScript==
// @name         我的自制加密脚本 (修复缓存版)
// @namespace    http://scriptcat.org/
// @version      1.1
// @description  自定义加密外壳测试
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(async function () {
    'use strict';

    // ========== 请替换为你刚才生成的 Base64 密文 ==========
    // 这里是你用那个 hex key 算出来的 alert("代码解密成功"); 的密文
    const CIPHER_BASE64 = 'asBFRvmd/wQkTNg+UlNG1lShlncm3e/cMJIbvNPGY0c=';
    // ======================================================

    const SALT_BASE64 = 'UG93ZXJfQnlfQ29sZF9XaW5keUdHRw==';
    const IV_BASE64 = 'eXV1Y2lfbWFpZF9Db2xkXw==';
    const ITERATIONS = 100000;

    function base64ToBytes(base64) {
        const binStr = atob(base64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
            bytes[i] = binStr.charCodeAt(i);
        }
        return bytes;
    }

    function bytesToString(bytes) {
        return new TextDecoder().decode(bytes);
    }

    // 【优化点1】：更改了存储的 Key，强制绕过之前的错误密码缓存
    let password = GM_getValue('my_secure_password_v1', '');
    if (!password) {
        password = prompt('请输入你的解密密码：');
        if (password) {
            GM_setValue('my_secure_password_v1', password);
        } else {
            alert('密码不能为空，脚本无法运行。');
            return;
        }
    }

    try {
        const salt = base64ToBytes(SALT_BASE64);
        const iv = base64ToBytes(IV_BASE64);
        const ciphertext = base64ToBytes(CIPHER_BASE64);

        if (iv.length !== 16) {
            throw new Error('IV 长度错误，必须为 16 字节');
        }

        const enc = new TextEncoder();
        const passwordBytes = enc.encode(password);

        const keyMaterial = await crypto.subtle.importKey(
            'raw', passwordBytes, 'PBKDF2', false, ['deriveKey']
        );

        const aesKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-CBC', length: 256 },
            false,
            ['decrypt']
        );

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv: iv },
            aesKey,
            ciphertext
        );

        const originalCode = bytesToString(new Uint8Array(decryptedBuffer));
        if (!originalCode) throw new Error('解密结果为空');

        // 直接在当前高权限扩展上下文中执行
        Function(originalCode)();

    } catch (e) {
        // 【优化点2】：解密失败时，自动清空当前存储的错误密码，方便刷新重试
        GM_setValue('my_secure_password_v1', '');
        alert('解密失败，密码可能错误。请刷新页面重试！\n错误详情: ' + e.message);
    }
})();