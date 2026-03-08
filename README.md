# CotizacionWeb

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.3.17.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:5010/`. The application will automatically reload if you change any of the source files.

## API base URL

By default the app calls `http://localhost:5011/api`.

## Backend Java

This repository now uses a Java backend at `../backend-java/` (Spring Boot) with the same API contract as the previous backend.

Run it from the project root:

```bash
npm run backend:java
```

You can override it from `public/index.html` before Angular bootstraps:

```html
<script>
  window.__APP_API_BASE_URL__ = 'https://your-api.example.com/api';
</script>
```

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
