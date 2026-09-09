package com.zexiaotong.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://lwl555.github.io/zexiaotong/";
    private static final String SITE_HOST = "https://lwl555.github.io/";
    private static final String CHANNEL_ID = "zex_default";
    private static final int REQUEST_SELECT_FILE = 100;
    private static final int REQ_NOTIF = 101;

    private WebView webView;
    private ValueCallback<Uri[]> mFilePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        ProgressBar progress = findViewById(R.id.progress);

        // Android 13+ 需要在运行时申请通知权限
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
            }
        }

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setMediaPlaybackRequiresUserGesture(false);

        // 网页端通过 window.ZexBridge.notify(...) 把站内消息弹到手机通知栏
        webView.addJavascriptInterface(new ZexBridge(), "ZexBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // 站内链接留在 WebView；站外链接跳系统浏览器
                if (url != null && url.startsWith(SITE_HOST)) return false;
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(i);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (progress != null) progress.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (progress != null) progress.setVisibility(View.GONE);
            }
        });

        // 支持 <input type=file> 图片上传（相册选择）
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             WebChromeClient.FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) mFilePathCallback.onReceiveValue(null);
                mFilePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                // 收敛为图片选择，避免误操作其它文件类型
                String[] accept = fileChooserParams.getAcceptTypes();
                if (accept != null && accept.length > 0 && accept[0] != null && !accept[0].isEmpty()) {
                    intent.setType(accept[0]);
                } else {
                    intent.setType("image/*");
                }
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择图片"), REQUEST_SELECT_FILE);
                } catch (ActivityNotFoundException e) {
                    mFilePathCallback = null;
                    Toast.makeText(MainActivity.this, "未找到文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        // 通知栏点击 / 冷启动：带 route 则直达对应功能页
        String route = getIntent() != null ? getIntent().getStringExtra("route") : null;
        webView.loadUrl(route != null && !route.isEmpty() ? APP_URL + "#" + route : APP_URL);
    }

    // 网页端调用的桥接对象
    public class ZexBridge {
        @android.webkit.JavascriptInterface
        public void notify(String title, String body, String route) {
            showNotification(title, body, route);
        }
    }

    private void showNotification(String title, String body, String route) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = nm.getNotificationChannel(CHANNEL_ID);
            if (ch == null) {
                ch = new NotificationChannel(CHANNEL_ID, "择校通通知", NotificationManager.IMPORTANCE_DEFAULT);
                nm.createNotificationChannel(ch);
            }
        }
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (route != null && !route.isEmpty()) intent.putExtra("route", route);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = (Build.VERSION.SDK_INT >= 26)
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        b.setContentTitle(title != null && !title.isEmpty() ? title : "择校通")
                .setContentText(body != null ? body : "")
                .setSmallIcon(R.drawable.ic_notif)
                .setContentIntent(pi)
                .setAutoCancel(true);

        nm.notify((int) System.currentTimeMillis(), b.build());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String route = intent != null ? intent.getStringExtra("route") : null;
        if (route != null && !route.isEmpty() && webView != null) {
            webView.loadUrl(APP_URL + "#" + route);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_SELECT_FILE) {
            if (mFilePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) results = new Uri[]{Uri.parse(dataString)};
            }
            mFilePathCallback.onReceiveValue(results);
            mFilePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
