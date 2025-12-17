import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectionGroupsStepComponent } from './connection-groups-step';

describe('ConnectionGroupsStepComponent', () => {
  let component: ConnectionGroupsStepComponent;
  let fixture: ComponentFixture<ConnectionGroupsStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectionGroupsStepComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConnectionGroupsStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
