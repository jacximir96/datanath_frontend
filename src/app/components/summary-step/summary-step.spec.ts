import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SummaryStep } from './summary-step';

describe('SummaryStep', () => {
  let component: SummaryStep;
  let fixture: ComponentFixture<SummaryStep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummaryStep]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SummaryStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
