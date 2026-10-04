import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => {
    console.error(err);
    const root = document.querySelector('app-root');
    if (root) {
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = 'No pudimos iniciar la aplicación. Revisa tu conexión y vuelve a cargar la página.';
      root.replaceChildren(message);
    }
  });
