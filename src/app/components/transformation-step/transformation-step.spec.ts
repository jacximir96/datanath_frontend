import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransformationStep } from './transformation-step';

describe('TransformationStep', () => {
  let component: TransformationStep;
  let fixture: ComponentFixture<TransformationStep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransformationStep]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransformationStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
