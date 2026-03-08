import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { distinctUntilChanged } from 'rxjs';
import { LocationOption, RegisterPayload, UserRole } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService } from '../../../core/services/location.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatAutocompleteModule, MatFormFieldModule, MatInputModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private readonly destroyRef = inject(DestroyRef);

  protected step = 1;
  protected selectedRole: UserRole | null = null;
  protected errorMessage = '';
  protected isSubmitting = false;
  protected isLoadingLocations = false;
  protected locationsError = '';

  protected regionOptions: LocationOption[] = [];
  protected filteredRegionOptions: LocationOption[] = [];
  protected cityOptions: LocationOption[] = [];
  protected filteredCityOptions: LocationOption[] = [];
  protected communeOptions: LocationOption[] = [];
  protected filteredCommuneOptions: LocationOption[] = [];

  private selectedRegion: LocationOption | null = null;
  private selectedCity: LocationOption | null = null;
  private selectedCommune: LocationOption | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    role: ['maestro' as UserRole, Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    region: ['', [Validators.required, Validators.minLength(2)]],
    regionId: ['', Validators.required],
    city: ['', [Validators.required, Validators.minLength(2)]],
    cityId: ['', Validators.required],
    commune: ['', [Validators.required, Validators.minLength(2)]],
    communeId: ['', Validators.required],
    businessName: [''],
    rut: [''],
    address: ['', [Validators.required, Validators.minLength(4)]],
    specialty: [''],
    experienceYears: [0]
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly locationService: LocationService,
    private readonly router: Router
  ) {
    this.form.controls.city.disable({ emitEvent: false });
    this.form.controls.cityId.disable({ emitEvent: false });
    this.form.controls.commune.disable({ emitEvent: false });
    this.form.controls.communeId.disable({ emitEvent: false });
    this.bindLocationControls();
    void this.ensureRegionsLoaded();
  }

  protected chooseRole(role: UserRole): void {
    this.selectedRole = role;
    this.form.controls.role.setValue(role);
    this.step = 2;
    this.syncRoleValidators(role);
    void this.ensureRegionsLoaded();
  }

  protected backToStepOne(): void {
    this.step = 1;
    this.errorMessage = '';
  }

  protected async selectRegionByName(name: string): Promise<void> {
    const selected = this.regionOptions.find((item) => this.sameText(item.name, name)) || null;
    if (!selected) {
      return;
    }

    this.selectedRegion = selected;
    this.form.controls.region.setValue(selected.name, { emitEvent: false });
    this.form.controls.regionId.setValue(selected.id, { emitEvent: false });
    this.filteredRegionOptions = this.filterOptions(this.regionOptions, selected.name);

    this.resetCitySelection();
    this.resetCommuneSelection();
    await this.loadCities(selected.id);
  }

  protected async selectCityByName(name: string): Promise<void> {
    const selected = this.cityOptions.find((item) => this.sameText(item.name, name)) || null;
    if (!selected) {
      return;
    }

    this.selectedCity = selected;
    this.form.controls.city.setValue(selected.name, { emitEvent: false });
    this.form.controls.cityId.setValue(selected.id, { emitEvent: false });
    this.filteredCityOptions = this.filterOptions(this.cityOptions, selected.name);

    this.resetCommuneSelection();
    await this.loadCommunes(selected.id);
  }

  protected selectCommuneByName(name: string): void {
    const selected = this.communeOptions.find((item) => this.sameText(item.name, name)) || null;
    if (!selected) {
      return;
    }

    this.selectedCommune = selected;
    this.form.controls.commune.setValue(selected.name, { emitEvent: false });
    this.form.controls.communeId.setValue(selected.id, { emitEvent: false });
    this.filteredCommuneOptions = this.filterOptions(this.communeOptions, selected.name);
  }

  protected async submit(): Promise<void> {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    const normalizedName = values.name.trim().replace(/\s+/g, ' ');
    if (values.role === 'maestro' && normalizedName.split(' ').length < 2) {
      this.errorMessage = 'Para maestro, ingresa nombre y apellido.';
      return;
    }

    const payload: RegisterPayload = {
      role: values.role,
      name: normalizedName,
      email: values.email,
      password: values.password,
      phone: values.phone,
      region: values.region.trim(),
      city: values.city.trim(),
      commune: values.commune.trim(),
      businessName: values.businessName,
      rut: values.rut,
      address: values.address,
      specialty: values.specialty,
      experienceYears: values.experienceYears > 0 ? values.experienceYears : undefined
    };

    this.isSubmitting = true;
    try {
      const user = await this.authService.register(payload);
      this.router.navigateByUrl(this.authService.dashboardRouteForUser(user));
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
    } finally {
      this.isSubmitting = false;
    }
  }

  protected hasError(controlName:
    'name'
    | 'email'
    | 'password'
    | 'phone'
    | 'region'
    | 'city'
    | 'commune'
    | 'businessName'
    | 'rut'
    | 'address'
    | 'specialty'
    | 'experienceYears'
  ): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  protected hasLocationError(type: 'region' | 'city' | 'commune'): boolean {
    const valueControl = type === 'region'
      ? this.form.controls.region
      : type === 'city'
        ? this.form.controls.city
        : this.form.controls.commune;
    const idControl = type === 'region'
      ? this.form.controls.regionId
      : type === 'city'
        ? this.form.controls.cityId
        : this.form.controls.communeId;
    return (valueControl.touched || valueControl.dirty || idControl.touched || idControl.dirty)
      && (valueControl.invalid || idControl.invalid);
  }

  private bindLocationControls(): void {
    this.form.controls.region.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), distinctUntilChanged())
      .subscribe((value) => {
        const typedValue = value || '';
        this.filteredRegionOptions = this.filterOptions(this.regionOptions, typedValue);
        if (!this.matchesSelected(this.selectedRegion, typedValue)) {
          this.selectedRegion = null;
          this.form.controls.regionId.setValue('', { emitEvent: false });
          this.resetCitySelection();
          this.resetCommuneSelection();
        }
      });

    this.form.controls.city.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), distinctUntilChanged())
      .subscribe((value) => {
        const typedValue = value || '';
        this.filteredCityOptions = this.filterOptions(this.cityOptions, typedValue);
        if (!this.matchesSelected(this.selectedCity, typedValue)) {
          this.selectedCity = null;
          this.form.controls.cityId.setValue('', { emitEvent: false });
          this.resetCommuneSelection();
        }
      });

    this.form.controls.commune.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), distinctUntilChanged())
      .subscribe((value) => {
        const typedValue = value || '';
        this.filteredCommuneOptions = this.filterOptions(this.communeOptions, typedValue);
        if (!this.matchesSelected(this.selectedCommune, typedValue)) {
          this.selectedCommune = null;
          this.form.controls.communeId.setValue('', { emitEvent: false });
        }
      });
  }

  private async ensureRegionsLoaded(): Promise<void> {
    if (this.regionOptions.length > 0 || this.isLoadingLocations) {
      return;
    }

    this.isLoadingLocations = true;
    this.locationsError = '';
    try {
      this.regionOptions = await this.locationService.listRegions();
      this.filteredRegionOptions = this.regionOptions;
    } catch (error) {
      this.locationsError = 'No se pudo cargar el catalogo de regiones.';
    } finally {
      this.isLoadingLocations = false;
    }
  }

  private async loadCities(regionId: string): Promise<void> {
    this.form.controls.city.enable({ emitEvent: false });
    this.form.controls.cityId.enable({ emitEvent: false });
    this.isLoadingLocations = true;
    this.locationsError = '';
    try {
      this.cityOptions = await this.locationService.listCities(regionId);
      this.filteredCityOptions = this.cityOptions;
    } catch (error) {
      this.cityOptions = [];
      this.filteredCityOptions = [];
      this.locationsError = 'No se pudo cargar el catalogo de ciudades.';
    } finally {
      this.isLoadingLocations = false;
    }
  }

  private async loadCommunes(cityId: string): Promise<void> {
    this.form.controls.commune.enable({ emitEvent: false });
    this.form.controls.communeId.enable({ emitEvent: false });
    this.isLoadingLocations = true;
    this.locationsError = '';
    try {
      this.communeOptions = await this.locationService.listCommunes(cityId);
      this.filteredCommuneOptions = this.communeOptions;
    } catch (error) {
      this.communeOptions = [];
      this.filteredCommuneOptions = [];
      this.locationsError = 'No se pudo cargar el catalogo de comunas.';
    } finally {
      this.isLoadingLocations = false;
    }
  }

  private resetCitySelection(): void {
    this.selectedCity = null;
    this.cityOptions = [];
    this.filteredCityOptions = [];
    this.form.controls.city.setValue('', { emitEvent: false });
    this.form.controls.cityId.setValue('', { emitEvent: false });
    this.form.controls.city.disable({ emitEvent: false });
    this.form.controls.cityId.disable({ emitEvent: false });
  }

  private resetCommuneSelection(): void {
    this.selectedCommune = null;
    this.communeOptions = [];
    this.filteredCommuneOptions = [];
    this.form.controls.commune.setValue('', { emitEvent: false });
    this.form.controls.communeId.setValue('', { emitEvent: false });
    this.form.controls.commune.disable({ emitEvent: false });
    this.form.controls.communeId.disable({ emitEvent: false });
  }

  private filterOptions(options: LocationOption[], value: string): LocationOption[] {
    const filter = (value || '').trim().toLowerCase();
    if (!filter) {
      return options;
    }
    return options.filter((item) => item.name.toLowerCase().includes(filter));
  }

  private matchesSelected(selected: LocationOption | null, typedValue: string): boolean {
    if (!selected) {
      return false;
    }
    return this.sameText(selected.name, typedValue);
  }

  private sameText(left: string, right: string): boolean {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }

  private syncRoleValidators(role: UserRole): void {
    const businessName = this.form.controls.businessName;
    const rut = this.form.controls.rut;
    const address = this.form.controls.address;

    if (role === 'ferreteria') {
      businessName.setValidators([Validators.required, Validators.minLength(2)]);
      rut.setValidators([Validators.required, Validators.minLength(7)]);
      address.setValidators([Validators.required, Validators.minLength(4)]);
    } else {
      businessName.clearValidators();
      businessName.setValue('');
      rut.setValidators([Validators.minLength(7)]);
    }

    businessName.updateValueAndValidity();
    rut.updateValueAndValidity();
    address.updateValueAndValidity();
  }
}
