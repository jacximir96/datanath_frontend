import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientStep } from './client-step';

describe('ClientStep', () => {
  let component: ClientStep;
  let fixture: ComponentFixture<ClientStep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientStep]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
