// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
window.onload = function () {
  // Initialize Swagger UI to load the BFF's OpenAPI spec served by the BFF
  // itself (instead of the swagger-ui webjar's default Petstore example).
  window.ui = SwaggerUIBundle({
    url: "/openapi/bff.yaml",
    dom_id: "#swagger-ui",
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  });
};
