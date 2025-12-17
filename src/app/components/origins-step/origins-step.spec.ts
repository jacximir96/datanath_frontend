import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OriginsStep } from './origins-step';

describe('OriginsStep', () => {
  let component: OriginsStep;
  let fixture: ComponentFixture<OriginsStep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OriginsStep]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OriginsStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
