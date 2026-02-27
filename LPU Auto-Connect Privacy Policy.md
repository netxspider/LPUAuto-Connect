---

# **Privacy Policy for LPU Auto-Connect**

**Last Updated:** February 2026

At **LPU Auto-Connect**, we take your privacy and the security of your university credentials seriously. This Privacy Policy explains how we handle your data, what we store, and how we ensure your information remains under your control.

### **1\. No Data Collection**

**LPU Auto-Connect does not collect, transmit, or store any of your personal data on external servers.** We do not have a backend database. All information required for the extension to function remains strictly on your local device. We do not sell, trade, or rent user information to third parties.

### **2\. Information We Handle**

To provide the auto-login and auto-fill features, the extension processes the following information:

* **Authentication Credentials:** Your LPU registration number and password for the Wi-Fi portal (`internet.lpu.in`) and student portals (`ums.lpu.in`, etc.).  
* **Network Diagnostics:** Temporary data such as IP addresses, DNS server names, and network latency (RTT) used for the "Network Health" and "Speed Test" features.  
* **Usage Statistics:** Local counters for your daily data consumption and total successful logins.

### **3\. Data Storage & Security**

* **Local-Only Storage:** All credentials are saved using `chrome.storage.local`. This data is stored within your browser's protected local profile.  
* **Encryption:** Credentials are encrypted on-device before storage using standard web encryption protocols (AES-GCM). This ensures that even if someone accesses your local browser files, your passwords are not stored in plaintext.  
* **Biometric Protection:** Users can opt-in to require system-level authentication (Fingerprint/PIN) to view or edit saved credentials within the extension settings.

### **4\. Permissions Disclosure**

We only request permissions that are strictly necessary for the extension's functionality:

* **`storage`**: To save your login profiles and preferences on your device.  
* **`tabs` & `activeTab`**: To automate the login process and manage university-related tabs.  
* **`webRequest`**: Used solely to calculate the size of network packets for the "Data Usage Tracker." We do not inspect the content of your web traffic.  
* **`proxy`**: To allow you to route browser traffic through a custom server of your choice.  
* **`alarms`**: To trigger the "Session Keep-Alive" pings to prevent Wi-Fi timeouts.

### **5\. Third-Party Services**

* **OCR (Tesseract.js):** The library used for solving UMS captchas runs entirely locally within your browser. No images of your captcha are ever uploaded to a cloud server for processing.  
* **DNS Providers:** If you use the "Secure DNS" feature, your DNS queries are handled by your selected provider (Google, Cloudflare, etc.) according to their respective privacy policies.

### **6\. User Control & Deletion**

You have total control over your data. You can view, edit, or delete your saved credentials at any time through the **Settings** tab. Uninstalling the extension will automatically remove all locally stored data associated with it.

### **7\. Changes to This Policy**

We may update this policy to reflect changes in the extension's features. Any updates will be documented in our official GitHub repository.

### **8\. Contact**

If you have questions regarding this policy or the security of the extension, you can reach out via our [GitHub Repository Support Page](https://github.com/netxspider/LPUInternetExtension/issues).

